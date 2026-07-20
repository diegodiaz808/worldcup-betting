import { estimateMatchOdds, estimatePlayerOdds } from './odds'

export interface SimplePick {
  player: string
  country: string
  flag: string
  marketId: string
  marketLabel: string
  line: string
  odds: number
  probability: number
  confidenceScore: number
  statBacking: string
  whyItWorks: string
  scope: 'player' | 'match'
}

export interface ComboProfile {
  id: string
  name: string
  description: string
  riskLevel: 'SEGURA' | 'MEDIA' | 'AGRESIVA'
  picks: SimplePick[]
  totalOdds: number
  combinedScore: number
  estimatedProbability: number
}

interface StatLine {
  matches: number
  goals: number
  assists: number
  rating: number
  shotsOnTarget: number
  shotsTotal: number
  foulsCommitted: number
  foulsDrawn: number
  yellowCards: number
  tackles: number
}

interface PlayerInput {
  name: string
  country: string
  flag: string
  club: string
  position: string
  starterRate: number
  stats2m: StatLine | null
  stats6m: StatLine | null
  recentStats?: StatLine | null
  wcStats: StatLine | null
  confirmedStarter?: boolean
}

interface TeamContext {
  country: string
  matches: number
  goalsForPerMatch: number
  goalsAgainstPerMatch: number
  cornersPerMatch: number
  yellowsPerMatch: number
  shotsPerMatch: number
  possession: number
  foulsCommitted?: number
}

const PLAYER_MARKETS_BY_POSITION: Record<string, string[]> = {
  FWD: ['player_shot_on_target', 'player_shot_any', 'player_foul_drawn'],
  MID: ['player_tackle', 'player_foul_committed', 'player_shot_any', 'player_shot_on_target', 'player_yellow_card'],
  DEF: ['player_tackle', 'player_foul_committed', 'player_yellow_card', 'player_shot_any'],
  GK: [],
}

const MARKET_LABEL: Record<string, string> = {
  player_shot_on_target: 'Tiro al arco',
  player_shot_any: 'Tiro',
  player_yellow_card: 'Amarilla',
  player_foul_committed: 'Falta cometida',
  player_tackle: 'Entrada',
  player_foul_drawn: 'Falta recibida',
  match_corners: 'Córners en el partido',
  match_yellow_cards: 'Amarillas en el partido',
  match_goals: 'Goles en el partido',
}

const STAT_BY_MARKET: Record<string, keyof StatLine> = {
  player_shot_on_target: 'shotsOnTarget',
  player_shot_any: 'shotsTotal',
  player_yellow_card: 'yellowCards',
  player_foul_committed: 'foulsCommitted',
  player_tackle: 'tackles',
  player_foul_drawn: 'foulsDrawn',
}

function perMatch(stats: StatLine | null, key: keyof StatLine) {
  if (!stats || stats.matches <= 0) return 0
  return Number(stats[key] ?? 0) / stats.matches
}

function weightedAverage(player: PlayerInput, key: keyof StatLine) {
  const recent = perMatch(player.recentStats ?? null, key)
  const recentMatches = player.recentStats?.matches ?? 0
  const s2 = perMatch(player.stats2m, key)
  const s6 = perMatch(player.stats6m, key)
  const base = s2 > 0 || s6 > 0 ? s2 * 0.7 + s6 * 0.3 : 0
  const wc = perMatch(player.wcStats, key)
  const wcMatches = player.wcStats?.matches ?? 0

  if (recentMatches >= 2 && wcMatches >= 2) return recent * 0.45 + wc * 0.35 + base * 0.20
  if (recentMatches >= 2) return recent * 0.60 + base * 0.40
  if (recentMatches === 1 && wcMatches >= 1) return recent * 0.35 + wc * 0.30 + base * 0.35
  if (recentMatches === 1) return recent * 0.35 + base * 0.65
  if (wcMatches >= 2) return base * 0.55 + wc * 0.45
  if (wcMatches === 1) return base * 0.75 + wc * 0.25
  return base
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function opponentFor(player: PlayerInput, home: TeamContext | null, away: TeamContext | null) {
  if (player.country === home?.country) return away
  if (player.country === away?.country) return home
  return null
}

function rivalFactor(marketId: string, opponent: TeamContext | null) {
  if (!opponent || opponent.matches <= 0) return 1

  if (marketId === 'player_shot_on_target' || marketId === 'player_shot_any') {
    return clamp(1 + (opponent.goalsAgainstPerMatch - 1.1) * 0.12 + (50 - opponent.possession) * 0.004, 0.82, 1.18)
  }

  if (marketId === 'player_foul_drawn') {
    const foulsPerMatch = opponent.foulsCommitted && opponent.matches > 0 ? opponent.foulsCommitted / opponent.matches : 11
    return clamp(1 + (foulsPerMatch - 11) * 0.015 + (opponent.yellowsPerMatch - 1.8) * 0.06, 0.85, 1.2)
  }

  if (marketId === 'player_foul_committed' || marketId === 'player_tackle') {
    return clamp(1 + (opponent.possession - 50) * 0.005 + (opponent.shotsPerMatch - 10) * 0.008, 0.85, 1.2)
  }

  if (marketId === 'player_yellow_card') {
    return clamp(1 + (opponent.possession - 50) * 0.004, 0.9, 1.12)
  }

  return 1
}

function sampleScore(player: PlayerInput) {
  const s2 = player.stats2m?.matches ?? 0
  const s6 = player.stats6m?.matches ?? 0
  const recent = player.recentStats?.matches ?? 0
  const wc = player.wcStats?.matches ?? 0
  return clamp((s2 * 0.45 + s6 * 0.18 + recent * 1.4 + wc * 1.1) / 10, 0.45, 1)
}

function getPlayerConfidence(player: PlayerInput, probability: number, adjustedAvg: number) {
  const starterBoost = player.confirmedStarter ? 12 : player.starterRate >= 0.8 ? 8 : player.starterRate >= 0.65 ? 3 : -10
  const sampleBoost = sampleScore(player) * 16
  const productionBoost = clamp(adjustedAvg * 8, 0, 14)
  return Math.round(clamp(probability * 62 + sampleBoost + productionBoost + starterBoost, 0, 94))
}

function statBacking(player: PlayerInput, marketId: string, baseAvg: number, adjustedAvg: number, opponent: TeamContext | null) {
  const wcMatches = player.wcStats?.matches ?? 0
  const recentMatches = player.recentStats?.matches ?? 0
  const recentPart = recentMatches > 0 ? `seleccion reciente ${perMatch(player.recentStats ?? null, STAT_BY_MARKET[marketId]).toFixed(2)}/pj en ${recentMatches} PJ` : 'sin muestra reciente de seleccion'
  const wcPart = wcMatches > 0 ? `WC ${perMatch(player.wcStats, STAT_BY_MARKET[marketId]).toFixed(2)}/pj en ${wcMatches} PJ` : 'sin muestra WC'
  const rivalPart = opponent && opponent.matches > 0 ? `rival actual: ${opponent.country}, ${opponent.matches} PJ WC` : 'rival sin muestra WC fuerte'
  return `${baseAvg.toFixed(2)}/pj base · ${recentPart} · ${wcPart} · ajuste rival ${adjustedAvg.toFixed(2)}/pj · ${rivalPart}`
}

function whyPlayerPick(player: PlayerInput, marketId: string, probability: number) {
  const market = MARKET_LABEL[marketId].toLowerCase()
  const starterText = player.confirmedStarter ? 'con XI confirmado' : `con ${Math.round(player.starterRate * 100)}% de titularidad estimada`
  return `${player.name} tiene perfil natural para ${market}: se toma su actualidad reciente y solo se ajusta por el rival de hoy. ${starterText}, probabilidad estimada ${(probability * 100).toFixed(0)}%.`
}

function buildPlayerPicks(players: PlayerInput[], home: TeamContext | null, away: TeamContext | null) {
  const picks: SimplePick[] = []

  for (const player of players) {
    if (player.starterRate < 0.45 && !player.confirmedStarter) continue
    const markets = PLAYER_MARKETS_BY_POSITION[player.position] ?? []

    for (const marketId of markets) {
      const key = STAT_BY_MARKET[marketId]
      const baseAvg = weightedAverage(player, key)
      if (baseAvg <= 0) continue

      const opponent = opponentFor(player, home, away)
      const adjustedAvg = baseAvg * rivalFactor(marketId, opponent)
      const est = estimatePlayerOdds(marketId, adjustedAvg, player.position)
      const confidenceScore = getPlayerConfidence(player, est.probability, adjustedAvg)
      if (confidenceScore < 58 || est.probability < 0.18) continue

      picks.push({
        player: player.name,
        country: player.country,
        flag: player.flag,
        marketId,
        marketLabel: MARKET_LABEL[marketId],
        line: est.line,
        odds: est.odds,
        probability: est.probability,
        confidenceScore,
        statBacking: statBacking(player, marketId, baseAvg, adjustedAvg, opponent),
        whyItWorks: whyPlayerPick(player, marketId, est.probability),
        scope: 'player',
      })
    }
  }

  return picks
}

function buildMatchPicks(home: TeamContext | null, away: TeamContext | null) {
  if (!home || !away || home.matches === 0 || away.matches === 0) return []

  const markets = [
    { id: 'match_corners', homeAvg: home.cornersPerMatch, awayAvg: away.cornersPerMatch },
    { id: 'match_yellow_cards', homeAvg: home.yellowsPerMatch, awayAvg: away.yellowsPerMatch },
    { id: 'match_goals', homeAvg: home.goalsForPerMatch, awayAvg: away.goalsForPerMatch },
  ]

  return markets.map(({ id, homeAvg, awayAvg }) => {
    const est = estimateMatchOdds(id, homeAvg, awayAvg)
    const confidenceScore = Math.round(clamp(est.probability * 70 + Math.min(home.matches + away.matches, 6) * 4, 0, 86))
    return {
      player: 'Partido',
      country: '',
      flag: '',
      marketId: id,
      marketLabel: MARKET_LABEL[id],
      line: est.line,
      odds: est.odds,
      probability: est.probability,
      confidenceScore,
      statBacking: `${home.country}: ${homeAvg.toFixed(2)}/pj · ${away.country}: ${awayAvg.toFixed(2)}/pj · solo Mundial actual`,
      whyItWorks: `Mercado de partido calculado solo con datos actuales del Mundial 2026 de estas selecciones, sin historial mundialista viejo.`,
      scope: 'match' as const,
    }
  }).filter((p) => p.confidenceScore >= 55)
}

export function buildPresetPicks({
  players,
  homeTeamStats,
  awayTeamStats,
}: {
  players: PlayerInput[]
  homeTeamStats: TeamContext | null
  awayTeamStats: TeamContext | null
}) {
  const playerPicks = buildPlayerPicks(players, homeTeamStats, awayTeamStats)
  const matchPicks = buildMatchPicks(homeTeamStats, awayTeamStats)

  return [...playerPicks, ...matchPicks]
    .sort((a, b) => b.confidenceScore - a.confidenceScore || b.probability - a.probability)
    .slice(0, 24)
}

// ─── Grupos de mercados correlacionados ──────────────────────────────────────
// Por jugador, solo puede aparecer UN mercado de cada grupo.
// Razón: player_shot_on_target ⊆ player_shot_any (si tirás al arco, ya tiraste).
// Mezclarlos en una combinada es apostar dos veces al mismo evento.
const CORRELATED_GROUPS: string[][] = [
  ['player_shot_on_target', 'player_shot_any'],   // tiro al arco ⊆ tiro
]

// Dado un jugador y sus picks ya seleccionados, ¿este nuevo pick entra en conflicto?
function hasCorrelationConflict(candidate: SimplePick, selected: SimplePick[]): boolean {
  const existing = selected.filter((s) => s.player === candidate.player)
  if (existing.length === 0) return false

  for (const group of CORRELATED_GROUPS) {
    if (!group.includes(candidate.marketId)) continue
    // el candidato pertenece a este grupo — ¿algún pick existente del mismo jugador también?
    if (existing.some((s) => group.includes(s.marketId))) return true
  }

  return false
}

export function buildRiskCombos(picks: SimplePick[]): ComboProfile[] {
  const viable = picks.filter((p) => p.confidenceScore >= 60)
  const profiles = [2, 3, 4, 5, 6, 7].flatMap((count) => [
    { id: `${count}x-segura`,   name: `${count}x Segura`,   description: `${count} selecciones con prioridad en acierto real y mercados naturales.`,           riskLevel: 'SEGURA'   as const, count, minScore: 76, floorScore: 66, oddsBias: 0.15 },
    { id: `${count}x-media`,    name: `${count}x Media`,    description: `${count} selecciones balanceando probabilidad y mejor paga.`,                          riskLevel: 'MEDIA'    as const, count, minScore: 68, floorScore: 62, oddsBias: 0.35 },
    { id: `${count}x-agresiva`, name: `${count}x Agresiva`, description: `${count} selecciones con más paga, sin bajar de un piso defendible por datos.`,        riskLevel: 'AGRESIVA' as const, count, minScore: 60, floorScore: 60, oddsBias: 0.58 },
  ])

  return profiles.flatMap((profile) => {
    const selected: SimplePick[] = []
    const byPlayer: Record<string, number> = {}
    const byMarket: Record<string, number> = {}

    const ranked = [...viable].sort((a, b) => {
      const scoreA = a.confidenceScore * (1 - profile.oddsBias) + Math.log(a.odds) * 100 * profile.oddsBias
      const scoreB = b.confidenceScore * (1 - profile.oddsBias) + Math.log(b.odds) * 100 * profile.oddsBias
      return scoreB - scoreA
    })

    for (let minScore = profile.minScore; minScore >= profile.floorScore && selected.length < profile.count; minScore -= 2) {
      for (const pick of ranked) {
        if (selected.length >= profile.count) break
        if (selected.includes(pick)) continue
        if (pick.confidenceScore < minScore) continue

        // Máximo 1 pick por jugador en una combinada (evita correlación implícita)
        if ((byPlayer[pick.player] ?? 0) >= 1) continue

        // Máximo 3 veces el mismo mercado en la combo (diversidad de eventos)
        if ((byMarket[pick.marketId] ?? 0) >= 3) continue

        // Sin mercados correlacionados del mismo jugador (ej: tiro + tiro al arco)
        if (hasCorrelationConflict(pick, selected)) continue

        selected.push(pick)
        byPlayer[pick.player]  = (byPlayer[pick.player]  ?? 0) + 1
        byMarket[pick.marketId] = (byMarket[pick.marketId] ?? 0) + 1
      }
    }

    if (selected.length < profile.count) return []

    const totalOdds            = selected.reduce((acc, p) => acc * p.odds, 1)
    const combinedScore        = Math.round(selected.reduce((sum, p) => sum + p.confidenceScore, 0) / selected.length)
    const estimatedProbability = Math.round(selected.reduce((acc, p) => acc * p.probability, 1) * 100)

    return [{
      id:                   profile.id,
      name:                 profile.name,
      description:          profile.description,
      riskLevel:            profile.riskLevel,
      picks:                selected,
      totalOdds:            Math.round(totalOdds * 100) / 100,
      combinedScore,
      estimatedProbability,
    }]
  })
}
