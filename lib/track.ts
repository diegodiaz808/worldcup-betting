import { prisma } from './prisma'

// Después de que termina un partido, verifica picks pendientes y los liquida automáticamente
export async function settleMatchPicks(matchId: string, fixtureExternalId: string) {
  const API_KEY = process.env.FOOTBALL_API_KEY ?? ''
  if (!API_KEY) return

  const [pending, pendingSystem] = await Promise.all([
    prisma.betTracker.findMany({ where: { matchId, result: 'pending' } }),
    prisma.systemPick.findMany({ where: { matchId, result: 'pending' } }),
  ])
  if (pending.length === 0 && pendingSystem.length === 0) return

  // Fetch player stats del partido para verificar picks de jugador
  const playerStatsMap: Record<string, Record<string, number>> = {}
  try {
    const res = await fetch(`https://v3.football.api-sports.io/fixtures/players?fixture=${fixtureExternalId}`, {
      headers: { 'x-apisports-key': API_KEY },
      signal: AbortSignal.timeout(10000),
    })
    const data = await res.json()
    for (const team of data?.response ?? []) {
      for (const entry of team.players ?? []) {
        const name = entry.player?.name ?? ''
        const s = entry.statistics?.[0] ?? {}
        playerStatsMap[name.toLowerCase()] = {
          shotsOnTarget:  s.shots?.on        ?? 0,
          shotsTotal:     s.shots?.total      ?? 0,
          yellowCards:    s.cards?.yellow     ?? 0,
          foulsCommitted: s.fouls?.committed  ?? 0,
          tackles:        s.tackles?.total    ?? 0,
          foulsDrawn:     s.fouls?.drawn      ?? 0,
        }
      }
    }
  } catch { /* si falla, dejamos pending */ }

  // Fetch match stats para corners / amarillas / goles del partido
  let matchStats: Record<string, number> = {}
  try {
    const res = await fetch(`https://v3.football.api-sports.io/fixtures/statistics?fixture=${fixtureExternalId}`, {
      headers: { 'x-apisports-key': API_KEY },
      signal: AbortSignal.timeout(10000),
    })
    const data = await res.json()
    let totalCorners = 0, totalYellow = 0
    for (const team of data?.response ?? []) {
      for (const s of team.statistics ?? []) {
        const v = typeof s.value === 'number' ? s.value : parseInt(String(s.value ?? '0')) || 0
        if (s.type === 'Corner Kicks') totalCorners += v
        if (s.type === 'Yellow Cards') totalYellow  += v
      }
    }
    const match = await prisma.match.findUnique({ where: { id: matchId } })
    const goals = match?.result ? match.result.split('-').reduce((a, b) => a + parseInt(b), 0) : null
    matchStats = { corners: totalCorners, yellowCards: totalYellow, goals: goals ?? 0 }
  } catch { /* skip */ }

  const findPlayerStats = (player: string) => {
    const key = player.toLowerCase()
    const direct = playerStatsMap[key]
    if (direct) return direct
    const last = key.split(' ').pop() ?? key
    return Object.entries(playerStatsMap).find(([name]) => name.includes(last) || key.includes(name.split(' ').pop() ?? name))?.[1]
  }

  const evaluate = (player: string, marketId: string, line: string): 'won' | 'lost' | 'pending' => {
    let result: 'won' | 'lost' | 'pending' = 'pending'

    // Parsear la línea: "1+ tiros al arco", "over 9.5 corners", etc.
    const normalizedLine = line.toLowerCase()
    const threshold = parseFloat(normalizedLine.match(/[\d.]+/)?.[0] ?? '1')

    if (marketId === 'player_shot_on_target') {
      const stats = findPlayerStats(player)
      if (stats) result = stats.shotsOnTarget >= threshold ? 'won' : 'lost'
    } else if (marketId === 'player_shot_any') {
      const stats = findPlayerStats(player)
      if (stats) result = stats.shotsTotal >= threshold ? 'won' : 'lost'
    } else if (marketId === 'player_yellow_card') {
      const stats = findPlayerStats(player)
      if (stats) result = stats.yellowCards >= threshold ? 'won' : 'lost'
    } else if (marketId === 'player_foul_committed') {
      const stats = findPlayerStats(player)
      if (stats) result = stats.foulsCommitted >= threshold ? 'won' : 'lost'
    } else if (marketId === 'player_tackle') {
      const stats = findPlayerStats(player)
      if (stats) result = stats.tackles >= threshold ? 'won' : 'lost'
    } else if (marketId === 'player_foul_drawn') {
      const stats = findPlayerStats(player)
      if (stats) result = stats.foulsDrawn >= threshold ? 'won' : 'lost'
    } else if (marketId === 'match_corners') {
      if (matchStats.corners !== undefined) result = matchStats.corners >= threshold ? 'won' : 'lost'
    } else if (marketId === 'match_yellow_cards') {
      if (matchStats.yellowCards !== undefined) result = matchStats.yellowCards >= threshold ? 'won' : 'lost'
    } else if (marketId === 'match_goals') {
      if (matchStats.goals !== undefined) result = matchStats.goals >= threshold ? 'won' : 'lost'
    }

    return result
  }

  for (const bet of pending) {
    const result = evaluate(bet.player, bet.marketId, bet.line)
    if (result === 'pending') continue

    const profit = result === 'won' ? (bet.stake * bet.odds) - bet.stake : -bet.stake
    await prisma.betTracker.update({
      where: { id: bet.id },
      data: { result, profit, settledAt: new Date() },
    })
  }

  for (const pick of pendingSystem) {
    let result: 'won' | 'lost' | 'pending' = 'pending'

    if (pick.kind === 'combo') {
      const items = JSON.parse(pick.picks || '[]') as { player: string; marketId: string; line: string }[]
      const results = items.map((item) => evaluate(item.player, item.marketId, item.line))
      if (results.every((r) => r === 'won')) result = 'won'
      else if (results.some((r) => r === 'lost')) result = 'lost'
    } else {
      result = evaluate(pick.player, pick.marketId, pick.line)
    }

    if (result === 'pending') continue

    const profit = result === 'won' ? (pick.stake * pick.odds) - pick.stake : -pick.stake
    await prisma.systemPick.update({
      where: { id: pick.id },
      data: { result, profit, settledAt: new Date() },
    })
  }

  await updateMarketAccuracy()
  await updateDailyStats()
}

// Recalcula la precisión acumulada por mercado
export async function updateMarketAccuracy() {
  const bets = await prisma.systemPick.findMany({
    where: { result: { in: ['won', 'lost'] } },
  })

  const byMarket: Record<string, { won: number; lost: number; oddsSum: number; stakeSum: number; profitSum: number }> = {}
  for (const b of bets) {
    if (!byMarket[b.marketId]) byMarket[b.marketId] = { won: 0, lost: 0, oddsSum: 0, stakeSum: 0, profitSum: 0 }
    const m = byMarket[b.marketId]
    if (b.result === 'won') m.won++
    else m.lost++
    m.oddsSum    += b.odds
    m.stakeSum   += b.stake
    m.profitSum  += b.profit ?? 0
  }

  for (const [marketId, m] of Object.entries(byMarket)) {
    const total = m.won + m.lost
    await prisma.marketAccuracy.upsert({
      where:  { marketId },
      update: { total, won: m.won, lost: m.lost, hitRate: m.won / total, avgOdds: m.oddsSum / total, roi: m.stakeSum > 0 ? m.profitSum / m.stakeSum : 0 },
      create: { marketId, total, won: m.won, lost: m.lost, hitRate: m.won / total, avgOdds: m.oddsSum / total, roi: m.stakeSum > 0 ? m.profitSum / m.stakeSum : 0 },
    })
  }
}

// Actualiza el resumen diario del test de sugerencias del sistema
export async function updateDailyStats() {
  const today = new Date().toISOString().slice(0, 10)
  const todayBets = await prisma.systemPick.findMany({
    where: { settledAt: { gte: new Date(today) }, result: { in: ['won', 'lost'] } },
  })
  if (todayBets.length === 0) return

  const won  = todayBets.filter((b) => b.result === 'won').length
  const lost = todayBets.filter((b) => b.result === 'lost').length
  const stake = todayBets.reduce((s, b) => s + b.stake, 0)
  const profit = todayBets.reduce((s, b) => s + (b.profit ?? 0), 0)

  await prisma.dailySystemStats.upsert({
    where:  { date: today },
    update: { totalPicks: todayBets.length, won, lost, hitRate: won / todayBets.length, roi: stake > 0 ? profit / stake : 0, aiInsight: '' },
    create: { date: today, totalPicks: todayBets.length, won, lost, hitRate: won / todayBets.length, roi: stake > 0 ? profit / stake : 0, aiInsight: '' },
  })
}
