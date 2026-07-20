import { prisma } from '@/lib/prisma'
import { seedPlayersIfEmpty } from '@/lib/sync'

export type RankingKey =
  | 'yellowCards'
  | 'shotsOnTarget'
  | 'goals'
  | 'foulsCommitted'
  | 'foulsDrawn'
  | 'assists'
  | 'tackles'
  | 'rating'

export interface RankingPlayer {
  id: string
  name: string
  country: string
  flag: string
  position: string
  value: number
  matches: number
  perMatch: number
}

export interface WorldCupTrend {
  id: string
  playerId: string
  name: string
  country: string
  flag: string
  position: string
  metric: string
  label: string
  baselinePerMatch: number
  worldCupPerMatch: number
  worldCupTotal: number
  matches: number
  change: number
  direction: 'up' | 'down'
  summary: string
}

const RANKING_LABELS: Record<RankingKey, string> = {
  yellowCards: 'Amarillas',
  shotsOnTarget: 'Tiros al arco',
  goals: 'Goles',
  foulsCommitted: 'Fouls cometidos',
  foulsDrawn: 'Fouls recibidos',
  assists: 'Asistencias',
  tackles: 'Tackles',
  rating: 'Rating',
}

const TREND_METRICS: { key: RankingKey; label: string; minimumBaseline: number; minimumTotal: number }[] = [
  { key: 'shotsOnTarget', label: 'tiros al arco', minimumBaseline: 0.15, minimumTotal: 2 },
  { key: 'goals', label: 'goles', minimumBaseline: 0.05, minimumTotal: 1 },
  { key: 'yellowCards', label: 'amarillas', minimumBaseline: 0.05, minimumTotal: 1 },
  { key: 'foulsCommitted', label: 'fouls cometidos', minimumBaseline: 0.25, minimumTotal: 2 },
  { key: 'foulsDrawn', label: 'fouls recibidos', minimumBaseline: 0.25, minimumTotal: 2 },
  { key: 'tackles', label: 'tackles', minimumBaseline: 0.4, minimumTotal: 3 },
]

function roundStat(value: number) {
  return Number(value.toFixed(2))
}

function buildRanking(players: Awaited<ReturnType<typeof getInsightPlayers>>, key: RankingKey, limit: number): RankingPlayer[] {
  return players
    .map((player) => {
      const wc = player.wcStats
      const value = Number(wc?.[key] ?? 0)
      const matches = wc?.matches ?? 0
      return {
        id: player.id,
        name: player.name,
        country: player.country,
        flag: player.flag,
        position: player.position,
        value: roundStat(value),
        matches,
        perMatch: matches > 0 ? roundStat(value / matches) : 0,
      }
    })
    .filter((player) => player.matches > 0 && player.value > 0)
    .sort((a, b) => b.value - a.value || b.perMatch - a.perMatch || a.name.localeCompare(b.name))
    .slice(0, limit)
}

async function getInsightPlayers() {
  await seedPlayersIfEmpty()

  return prisma.player.findMany({
    include: {
      wcStats: true,
      stats: { where: { period: '2m' } },
    },
  })
}

function getBaseline(player: Awaited<ReturnType<typeof getInsightPlayers>>[number], key: RankingKey) {
  const stats = player.stats[0]
  if (!stats || stats.matches <= 0) return 0
  return Number(stats[key] ?? 0) / stats.matches
}

function getTrendSummary(name: string, metric: string, direction: 'up' | 'down', wcRate: number, baseRate: number, matches: number) {
  const comparison = direction === 'up' ? 'muy por arriba' : 'muy por debajo'
  return `${name} viene ${comparison} de su promedio: ${roundStat(wcRate)} ${metric}/pj en el Mundial vs ${roundStat(baseRate)} en los ultimos 2 meses (${matches} PJ).`
}

function buildTrends(players: Awaited<ReturnType<typeof getInsightPlayers>>, direction: 'up' | 'down', limit: number): WorldCupTrend[] {
  const trends: WorldCupTrend[] = []

  for (const player of players) {
    const wc = player.wcStats
    if (!wc || wc.matches < 2) continue

    for (const metric of TREND_METRICS) {
      const worldCupTotal = Number(wc[metric.key] ?? 0)
      if (direction === 'up' && worldCupTotal < metric.minimumTotal) continue

      const baselinePerMatch = getBaseline(player, metric.key)
      const worldCupPerMatch = worldCupTotal / wc.matches
      if (baselinePerMatch <= 0 && worldCupPerMatch <= 0) continue

      const baselineForRatio = Math.max(baselinePerMatch, metric.minimumBaseline)
      const change = worldCupPerMatch / baselineForRatio

      if (direction === 'up' && change < 1.8) continue
      if (direction === 'down' && !(baselinePerMatch >= metric.minimumBaseline * 2 && worldCupPerMatch <= baselinePerMatch * 0.35)) continue

      trends.push({
        id: `${player.id}-${metric.key}-${direction}`,
        playerId: player.id,
        name: player.name,
        country: player.country,
        flag: player.flag,
        position: player.position,
        metric: metric.key,
        label: metric.label,
        baselinePerMatch: roundStat(baselinePerMatch),
        worldCupPerMatch: roundStat(worldCupPerMatch),
        worldCupTotal: roundStat(worldCupTotal),
        matches: wc.matches,
        change: roundStat(direction === 'up' ? change : baselinePerMatch / Math.max(worldCupPerMatch, 0.05)),
        direction,
        summary: getTrendSummary(player.name, metric.label, direction, worldCupPerMatch, baselinePerMatch, wc.matches),
      })
    }
  }

  return trends
    .sort((a, b) => b.change - a.change || b.worldCupTotal - a.worldCupTotal)
    .slice(0, limit)
}

export async function getWorldCupInsights(limit = 5) {
  const players = await getInsightPlayers()
  const rankingKeys: RankingKey[] = ['yellowCards', 'shotsOnTarget', 'goals', 'foulsCommitted', 'foulsDrawn']

  return {
    rankings: Object.fromEntries(
      rankingKeys.map((key) => [
        key,
        {
          label: RANKING_LABELS[key],
          players: buildRanking(players, key, limit),
        },
      ])
    ) as Record<RankingKey, { label: string; players: RankingPlayer[] }>,
    surprises: buildTrends(players, 'up', limit),
    dropOffs: buildTrends(players, 'down', limit),
  }
}

export async function getWorldCupPlayerBoards(limit = 10) {
  const players = await getInsightPlayers()
  const rankingKeys: RankingKey[] = ['goals', 'shotsOnTarget', 'yellowCards', 'foulsCommitted', 'foulsDrawn', 'assists', 'tackles', 'rating']

  return {
    boards: rankingKeys.map((key) => ({
      key,
      label: RANKING_LABELS[key],
      players: buildRanking(players, key, limit),
    })),
    surprises: buildTrends(players, 'up', limit),
    dropOffs: buildTrends(players, 'down', limit),
  }
}
