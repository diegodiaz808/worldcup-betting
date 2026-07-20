import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateAlerts } from '@/lib/alerts'
import { buildPresetPicks, buildRiskCombos } from '@/lib/pick-engine'

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const match = await prisma.match.findUnique({ where: { id: params.id } })
  if (!match) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const players = await prisma.player.findMany({
    where: { country: { in: [match.homeTeam, match.awayTeam] }, status: 'active' },
    include: { stats: true, wcStats: true },
    orderBy: { starterRate: 'desc' },
  })

  const [homeTeamStats, awayTeamStats, homeRecentStats, awayRecentStats] = await Promise.all([
    prisma.teamStats.findUnique({ where: { country: match.homeTeam } }),
    prisma.teamStats.findUnique({ where: { country: match.awayTeam } }),
    prisma.teamRecentStats.findUnique({ where: { country: match.homeTeam } }),
    prisma.teamRecentStats.findUnique({ where: { country: match.awayTeam } }),
  ])

  const toTeamCtx = (t: typeof homeTeamStats | typeof homeRecentStats) => t ? {
    country: t.country, flag: t.flag, matches: t.matches,
    goalsForPerMatch:     t.goalsForPerMatch,
    goalsAgainstPerMatch: t.matches > 0 ? t.goalsAgainst / t.matches : 0,
    cornersPerMatch:  t.cornersPerMatch,
    yellowsPerMatch:  t.yellowsPerMatch,
    offsidesPerMatch: 'offsidesPerMatch' in t ? t.offsidesPerMatch : 0,
    shotsPerMatch:    t.shotsPerMatch,
    possession:       t.possession,
    foulsCommitted:   t.foulsCommitted,
  } : null

  const lineupNames = new Set<string>()
  for (const entry of [...((match.lineupHome as { name?: string }[] | null) ?? []), ...((match.lineupAway as { name?: string }[] | null) ?? [])]) {
    if (entry.name) lineupNames.add(entry.name.toLowerCase())
  }

  const playersForAlerts = players.map((p) => {
    const s2m = p.stats.find((s) => s.period === '2m')
    return {
      id: p.id, name: p.name, country: p.country, flag: p.flag,
      position: p.position, status: p.status,
      stats2m: s2m ? { matches: s2m.matches, shotsOnTarget: s2m.shotsOnTarget, foulsCommitted: s2m.foulsCommitted, yellowCards: s2m.yellowCards, tackles: s2m.tackles, goals: s2m.goals, assists: s2m.assists, rating: s2m.rating } : null,
      wcStats: p.wcStats ? { matches: p.wcStats.matches, yellowCards: p.wcStats.yellowCards, goals: p.wcStats.goals, assists: p.wcStats.assists, shotsOnTarget: p.wcStats.shotsOnTarget, foulsCommitted: p.wcStats.foulsCommitted, tackles: p.wcStats.tackles, rating: p.wcStats.rating } : null,
    }
  })
  const alerts = generateAlerts(playersForAlerts)

  const toStatLine = (s: typeof players[number]['stats'][number] | typeof players[number]['wcStats'] | null) => s ? {
    matches: s.matches,
    goals: s.goals,
    assists: s.assists,
    rating: s.rating,
    shotsOnTarget: s.shotsOnTarget,
    shotsTotal: 'shotsTotal' in s ? s.shotsTotal : 0,
    foulsCommitted: s.foulsCommitted,
    foulsDrawn: s.foulsDrawn,
    yellowCards: s.yellowCards,
    tackles: s.tackles,
  } : null

  const playerInputs = players.map((p) => {
    const s2m = p.stats.find((s) => s.period === '2m')
    const s6m = p.stats.find((s) => s.period === '6m')
    const recent = p.stats.find((s) => s.period === 'recent_nt')
    return {
      name: p.name, country: p.country, flag: p.flag, club: p.club, position: p.position,
      starterRate: p.starterRate,
      stats2m: toStatLine(s2m ?? null),
      stats6m: toStatLine(s6m ?? null),
      recentStats: toStatLine(recent ?? null),
      wcStats: toStatLine(p.wcStats),
      confirmedStarter: lineupNames.size > 0 ? lineupNames.has(p.name.toLowerCase()) : undefined,
    }
  })

  const picks  = buildPresetPicks({
    players: playerInputs,
    homeTeamStats: toTeamCtx(homeRecentStats ?? homeTeamStats),
    awayTeamStats: toTeamCtx(awayRecentStats ?? awayTeamStats),
  })
  const combos = buildRiskCombos(picks)

  const matchName = `${match.homeTeam} vs ${match.awayTeam}`
  await Promise.all([
    ...picks.map((pick) => {
      const signature = [match.id, 'simple', pick.player, pick.marketId, pick.line].join('|')
      return prisma.systemPick.upsert({
        where: { signature },
        update: {
          matchName,
          marketLabel: pick.marketLabel,
          odds: pick.odds,
          stake: 1,
        },
        create: {
          signature,
          kind: 'simple',
          matchId: match.id,
          matchName,
          player: pick.player,
          marketId: pick.marketId,
          marketLabel: pick.marketLabel,
          line: pick.line,
          odds: pick.odds,
          stake: 1,
        },
      })
    }),
    ...combos.map((combo) => {
      const signature = [match.id, 'combo', combo.id, combo.picks.map((p) => `${p.player}:${p.marketId}:${p.line}`).join('/')].join('|')
      return prisma.systemPick.upsert({
        where: { signature },
        update: {
          matchName,
          odds: combo.totalOdds,
          picks: JSON.stringify(combo.picks),
          riskLevel: combo.riskLevel,
          stake: 1,
        },
        create: {
          signature,
          kind: 'combo',
          matchId: match.id,
          matchName,
          player: 'Combinada',
          marketId: `combo_${combo.id}`,
          marketLabel: combo.name,
          line: `${combo.picks.length} selecciones`,
          odds: combo.totalOdds,
          stake: 1,
          picks: JSON.stringify(combo.picks),
          riskLevel: combo.riskLevel,
        },
      })
    }),
  ])

  return NextResponse.json({ picks, combos, alerts, generatedBy: 'preset-stat-engine' })
}
