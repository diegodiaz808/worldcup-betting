export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.DEMO_EXPORT === '1') return // static demo build: no crons, no sync

  const cron = await import('node-cron')
  const { runDailySync, syncUpcomingLineups, syncPostMatch } = await import('./lib/sync')
  const { prisma } = await import('./lib/prisma')

  async function scheduleLineupFetches() {
    const now = new Date()
    const endOfDay = new Date(now); endOfDay.setHours(23, 59, 59, 999)

    const todayMatches = await prisma.match.findMany({
      where: {
        status: 'scheduled',
        lineupFetchedAt: null,
        date: { gte: now, lte: endOfDay },
        externalId: { not: null },
      },
    })

    for (const match of todayMatches) {
      const fetchAt = new Date(match.date.getTime() - 35 * 60 * 1000)
      const msUntilFetch = fetchAt.getTime() - Date.now()

      if (msUntilFetch < 0) {
        syncUpcomingLineups().catch((e) => console.error('[lineup] error:', e))
        continue
      }

      console.log(`[cron] Lineup: ${match.homeTeam} vs ${match.awayTeam} en ${Math.round(msUntilFetch / 60000)} min`)
      setTimeout(async () => {
        try { await syncUpcomingLineups() }
        catch (e) { console.error('[cron:lineup] error:', e) }
      }, msUntilFetch)

      // Post-match: 2 horas después del KO
      const postMatchAt = new Date(match.date.getTime() + 2 * 3600 * 1000)
      const msUntilPost = postMatchAt.getTime() - Date.now()
      if (msUntilPost > 0) {
        setTimeout(async () => {
          try { await syncPostMatch() }
          catch (e) { console.error('[cron:post-match] error:', e) }
        }, msUntilPost)
        console.log(`[cron] Post-match: ${match.homeTeam} vs ${match.awayTeam} en ${Math.round(msUntilPost / 60000)} min`)
      }
    }

    if (todayMatches.length === 0) {
      console.log('[cron] Sin partidos hoy')
    }
  }

  // ── 6am: sync diario + re-programar timers del día ────────────────────────
  cron.schedule('0 6 * * *', async () => {
    try { await runDailySync(); await scheduleLineupFetches() }
    catch (e) { console.error('[cron:daily] error:', e) }
  })

  await scheduleLineupFetches()
  console.log('[cron] Activo: daily@6am | lineup+post-match programados por horario de partidos')
}
