import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateAlerts } from '@/lib/alerts'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const match = await prisma.match.findUnique({ where: { id: params.id } })
  if (!match) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Obtener todos los jugadores de ambas selecciones
  const players = await prisma.player.findMany({
    where: { country: { in: [match.homeTeam, match.awayTeam] } },
    include: {
      stats: true,
      wcStats: true,
    },
    orderBy: [{ country: 'asc' }, { starterRate: 'desc' }],
  })

  // Mapear al formato que espera generateAlerts
  const playersForAlerts = players.map((p) => {
    const s2m = p.stats.find((s) => s.period === '2m')
    return {
      id: p.id,
      name: p.name,
      country: p.country,
      flag: p.flag,
      position: p.position,
      status: p.status,
      stats2m: s2m
        ? {
            matches: s2m.matches,
            shotsOnTarget: s2m.shotsOnTarget,
            foulsCommitted: s2m.foulsCommitted,
            yellowCards: s2m.yellowCards,
            tackles: s2m.tackles,
            goals: s2m.goals,
            assists: s2m.assists,
            rating: s2m.rating,
          }
        : null,
      wcStats: p.wcStats
        ? {
            matches: p.wcStats.matches,
            yellowCards: p.wcStats.yellowCards,
            goals: p.wcStats.goals,
            assists: p.wcStats.assists,
            shotsOnTarget: p.wcStats.shotsOnTarget,
            foulsCommitted: p.wcStats.foulsCommitted,
            tackles: p.wcStats.tackles,
            rating: p.wcStats.rating,
          }
        : null,
    }
  })

  const alerts = generateAlerts(playersForAlerts)

  // Separar jugadores por equipo, con stats enriquecidas
  const enrichPlayers = (country: string) =>
    players
      .filter((p) => p.country === country)
      .map((p) => {
        const s2m = p.stats.find((s) => s.period === '2m')
        return {
          id: p.id,
          name: p.name,
          club: p.club,
          position: p.position,
          flag: p.flag,
          status: p.status,
          statusReason: p.statusReason,
          starterRate: p.starterRate,
          stats2m: s2m ?? null,
          wcStats: p.wcStats ?? null,
        }
      })

  return NextResponse.json({
    match,
    home: enrichPlayers(match.homeTeam),
    away: enrichPlayers(match.awayTeam),
    alerts,
  })
}
