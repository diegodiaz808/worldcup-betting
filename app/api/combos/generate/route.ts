import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildPresetPicks, buildRiskCombos } from '@/lib/pick-engine'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const matchId: string | undefined = body.matchId

  let match = null
  const include = { stats: true, wcStats: true } as const

  const players = await (async () => {
    if (matchId) {
      match = await prisma.match.findUnique({ where: { id: matchId } })
      if (!match) return null
      return prisma.player.findMany({
        where: { country: { in: [match.homeTeam, match.awayTeam] }, status: 'active' },
        include,
        orderBy: { starterRate: 'desc' },
      })
    }
    return prisma.player.findMany({ where: { status: 'active' }, include })
  })()

  if (players === null) return NextResponse.json({ error: 'Match not found' }, { status: 404 })

  // Stats de equipo en el Mundial
  const teamStats = match
    ? await (async () => {
        const m = match as { homeTeam: string; awayTeam: string }
        const [home, away, homeRecent, awayRecent] = await Promise.all([
          prisma.teamStats.findUnique({ where: { country: m.homeTeam } }),
          prisma.teamStats.findUnique({ where: { country: m.awayTeam } }),
          prisma.teamRecentStats.findUnique({ where: { country: m.homeTeam } }),
          prisma.teamRecentStats.findUnique({ where: { country: m.awayTeam } }),
        ])
        const toCtx = (t: typeof home | typeof homeRecent) => t ? {
          country: t.country, flag: t.flag, matches: t.matches,
          goalsForPerMatch: t.goalsForPerMatch, goalsAgainstPerMatch: t.matches > 0 ? t.goalsAgainst / t.matches : 0,
          cornersPerMatch: t.cornersPerMatch, yellowsPerMatch: t.yellowsPerMatch,
          offsidesPerMatch: 'offsidesPerMatch' in t ? t.offsidesPerMatch : 0, shotsPerMatch: t.shotsPerMatch,
          possession: t.possession,
        } : null
        return { home: toCtx(homeRecent ?? home), away: toCtx(awayRecent ?? away) }
      })()
    : undefined

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
      name: p.name,
      country: p.country,
      flag: p.flag,
      club: p.club,
      position: p.position,
      starterRate: p.starterRate,
      stats2m: toStatLine(s2m ?? null),
      stats6m: toStatLine(s6m ?? null),
      recentStats: toStatLine(recent ?? null),
      wcStats: toStatLine(p.wcStats),
    }
  })

  const m = match as { homeTeam: string; awayTeam: string } | null
  const matchName = m ? `${m.homeTeam} vs ${m.awayTeam}` : undefined
  const picks = buildPresetPicks({
    players: playerInputs,
    homeTeamStats: teamStats?.home ?? null,
    awayTeamStats: teamStats?.away ?? null,
  })
  const filtered = buildRiskCombos(picks).filter((c) => c.combinedScore >= 65)

  const saved = await Promise.all(
    filtered.map((c) =>
      prisma.combo.create({
        data: {
          matchId: matchId ?? null,
          name: c.name, riskLevel: c.riskLevel, totalOdds: c.totalOdds,
          realProbability: c.estimatedProbability,
          confidenceScore: c.combinedScore,
          picks: JSON.stringify(c.picks),
          justification: c.description,
          whyItWorks: 'Combinada armada con mercados predeterminados, actualidad de jugadores y ajuste contra rival actual.',
          edgeTip: 'No usa historial mundialista viejo ni generación creativa en vivo.',
          marketInsight: matchName ?? '',
        },
      })
    )
  )

  return NextResponse.json(saved.map((c) => ({ ...c, picks: JSON.parse(c.picks) })))
}
