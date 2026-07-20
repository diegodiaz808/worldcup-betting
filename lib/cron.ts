import cron from 'node-cron'
import { prisma } from './prisma'
import { runDailySync, syncUpcomingLineups, syncPostMatch, syncTeamStats } from './sync'
import { buildPresetPicks, buildRiskCombos } from './pick-engine'

let started = false

// IDs de timeouts activos, para no programar dos veces el mismo partido
const scheduledMatches = new Set<string>()

// ─── Regenerar picks de un partido con los datos más frescos ─────────────────
export async function refreshMatchPicks(matchId: string) {
  const match = await prisma.match.findUnique({ where: { id: matchId } })
  if (!match) return { ok: false, reason: 'match not found' }
  if (match.status === 'finished') return { ok: false, reason: 'finished' }

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

  const toTeamCtx = (t: typeof homeTeamStats | typeof homeRecentStats) =>
    t
      ? {
          country: t.country, flag: t.flag, matches: t.matches,
          goalsForPerMatch:     t.goalsForPerMatch,
          goalsAgainstPerMatch: t.matches > 0 ? t.goalsAgainst / t.matches : 0,
          cornersPerMatch:      t.cornersPerMatch,
          yellowsPerMatch:      t.yellowsPerMatch,
          offsidesPerMatch:     'offsidesPerMatch' in t ? t.offsidesPerMatch : 0,
          shotsPerMatch:        t.shotsPerMatch,
          possession:           t.possession,
          foulsCommitted:       t.foulsCommitted,
        }
      : null

  const lineupNames = new Set<string>()
  for (const entry of [
    ...((match.lineupHome as { name?: string }[] | null) ?? []),
    ...((match.lineupAway as { name?: string }[] | null) ?? []),
  ]) {
    if (entry.name) lineupNames.add(entry.name.toLowerCase())
  }

  const toStatLine = (s: typeof players[number]['stats'][number] | typeof players[number]['wcStats'] | null) =>
    s
      ? {
          matches: s.matches, goals: s.goals, assists: s.assists, rating: s.rating,
          shotsOnTarget: s.shotsOnTarget, shotsTotal: 'shotsTotal' in s ? s.shotsTotal : 0,
          foulsCommitted: s.foulsCommitted, foulsDrawn: s.foulsDrawn,
          yellowCards: s.yellowCards, tackles: s.tackles,
        }
      : null

  const playerInputs = players.map((p) => {
    const s2m    = p.stats.find((s) => s.period === '2m')
    const s6m    = p.stats.find((s) => s.period === '6m')
    const recent = p.stats.find((s) => s.period === 'recent_nt')
    return {
      name: p.name, country: p.country, flag: p.flag, club: p.club, position: p.position,
      starterRate:      p.starterRate,
      stats2m:          toStatLine(s2m    ?? null),
      stats6m:          toStatLine(s6m    ?? null),
      recentStats:      toStatLine(recent ?? null),
      wcStats:          toStatLine(p.wcStats),
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
        where:  { signature },
        update: { matchName, marketLabel: pick.marketLabel, odds: pick.odds },
        create: {
          signature, kind: 'simple', matchId: match.id, matchName,
          player: pick.player, marketId: pick.marketId, marketLabel: pick.marketLabel,
          line: pick.line, odds: pick.odds, stake: 1,
        },
      })
    }),
    ...combos.map((combo) => {
      const signature = [match.id, 'combo', combo.id, combo.picks.map((p) => `${p.player}:${p.marketId}:${p.line}`).join('/')].join('|')
      return prisma.systemPick.upsert({
        where:  { signature },
        update: { matchName, odds: combo.totalOdds, picks: JSON.stringify(combo.picks), riskLevel: combo.riskLevel },
        create: {
          signature, kind: 'combo', matchId: match.id, matchName,
          player: 'Combinada', marketId: `combo_${combo.id}`,
          marketLabel: combo.name, line: `${combo.picks.length} selecciones`,
          odds: combo.totalOdds, stake: 1,
          picks: JSON.stringify(combo.picks), riskLevel: combo.riskLevel,
        },
      })
    }),
  ])

  console.log(`[cron] refreshMatchPicks: ${matchName} — ${picks.length} simples, ${combos.length} combinadas`)
  return { ok: true, matchName, simples: picks.length, combinadas: combos.length }
}

// ─── Programar eventos para un partido por su horario real ───────────────────
function scheduleMatch(match: { id: string; homeTeam: string; awayTeam: string; date: Date; externalId: string | null }) {
  if (scheduledMatches.has(match.id)) return

  const now       = Date.now()
  const kickoff   = match.date.getTime()
  const msToPreKO = kickoff - 30 * 60 * 1000 - now   // 30 min antes del KO
  const msToSettle = kickoff + 115 * 60 * 1000 - now  // ~115 min después del KO (90 + descuentos)

  const name = `${match.homeTeam} vs ${match.awayTeam}`

  // ① 30 min antes del KO: lineup + picks frescos
  if (msToPreKO > 0) {
    setTimeout(async () => {
      console.log(`[cron] Pre-KO: ${name} arranca en 30 min — actualizando lineup y picks`)
      try {
        await syncUpcomingLineups()
        await refreshMatchPicks(match.id)
        console.log(`[cron] Pre-KO OK: ${name}`)
      } catch (err) {
        console.error(`[cron] Pre-KO error (${name}):`, err)
      }
    }, msToPreKO)

    const koTime = new Date(kickoff).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })
    console.log(`[cron] Partido programado: ${name} → pre-KO a las ${koTime} AR`)
  }

  // ② ~115 min después del KO: liquidar picks
  if (msToSettle > 0) {
    setTimeout(async () => {
      console.log(`[cron] Post-match: liquidando picks de ${name}`)
      try {
        await syncPostMatch()
        await syncTeamStats()
        console.log(`[cron] Post-match OK: ${name}`)
      } catch (err) {
        console.error(`[cron] Post-match error (${name}):`, err)
      }
    }, msToSettle)
  }

  scheduledMatches.add(match.id)
}

// ─── Cargar todos los partidos pendientes y programarlos ─────────────────────
async function scheduleUpcomingMatches() {
  const matches = await prisma.match.findMany({
    where: {
      status: 'scheduled',
      date:   { gt: new Date() },  // solo los que no arrancaron todavía
    },
    orderBy: { date: 'asc' },
  })

  for (const m of matches) {
    scheduleMatch(m)
  }

  console.log(`[cron] ${matches.length} partidos próximos programados`)
}

// ─── Scheduler principal ──────────────────────────────────────────────────────
export function startCron() {
  if (started) return
  started = true

  // ① Programar partidos al arrancar
  scheduleUpcomingMatches().catch(console.error)

  // ② 6 AM (hora AR): sync completo + re-programar partidos nuevos
  cron.schedule('0 6 * * *', async () => {
    console.log('[cron] 6 AM — sync diario completo')
    try {
      await runDailySync()
      // Re-programar por si se agregaron partidos nuevos (ej: fase eliminatoria)
      await scheduleUpcomingMatches()
      console.log('[cron] Sync diario OK')
    } catch (err) {
      console.error('[cron] Error en sync diario:', err)
    }
  }, { timezone: 'America/Argentina/Buenos_Aires' })

  // ③ 12 PM (hora AR): stats de equipo del mundial (complementa el 6 AM)
  cron.schedule('0 12 * * *', async () => {
    try {
      await syncTeamStats()
      console.log('[cron] Team stats actualizados')
    } catch (err) {
      console.error('[cron] Error sincronizando team stats:', err)
    }
  }, { timezone: 'America/Argentina/Buenos_Aires' })

  console.log('[cron] Scheduler arrancado:')
  console.log('  → Al iniciar: programa pre-KO y liquidación para cada partido')
  console.log('  → 6 AM (AR): sync diario completo + re-programa partidos nuevos')
  console.log('  → 12 PM (AR): sync stats de equipo')
}
