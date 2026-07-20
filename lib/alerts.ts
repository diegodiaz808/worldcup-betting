export type AlertType =
  | 'HIGH_SHOTS'       // tira al arco más que el promedio de su posición
  | 'FOUL_MACHINE'     // faltas cometidas > promedio
  | 'YELLOW_PRONE'     // ritmo de amarillas alto (1 cada pocos partidos)
  | 'YELLOW_RISK'      // ya tiene amarilla en este mundial, si saca otra se va
  | 'ATTACKING_DEF'    // defensor/mediocampista con stats ofensivas sorprendentes
  | 'DEFENSIVE_FWD'    // delantero con recuperaciones altas
  | 'WC_HOT_STREAK'    // en racha en el mundial (mejor que su media de club)
  | 'UNDERPERFORMING'  // rinde menos que su nivel de club (puede explotar pronto)
  | 'SET_PIECE_THREAT' // goles o asistencias de pelota parada

export interface Alert {
  type: AlertType
  playerId: string
  playerName: string
  country: string
  flag: string
  position: string
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  betMarket: string
  description: string
  value: number
  benchmark: number
  unit: string
}

// Benchmarks por posición (promedios por partido)
const BENCHMARKS = {
  shotsOnTarget: { GK: 0, DEF: 0.3, MID: 0.7, FWD: 1.8 },
  foulsCommitted: { GK: 0.2, DEF: 2.1, MID: 1.9, FWD: 1.5 },
  yellowRate: 8,      // promedio: 1 amarilla cada 8 partidos
  tackles:    { GK: 0.1, DEF: 3.2, MID: 2.4, FWD: 0.9 },
}

interface PlayerForAlerts {
  id: string
  name: string
  country: string
  flag: string
  position: string
  status: string
  stats2m: {
    matches: number
    shotsOnTarget: number
    foulsCommitted: number
    yellowCards: number
    tackles: number
    goals: number
    assists: number
    rating: number
  } | null
  wcStats: {
    matches: number
    yellowCards: number
    goals: number
    assists: number
    shotsOnTarget: number
    foulsCommitted: number
    tackles: number
    rating: number
  } | null
}

export function generateAlerts(players: PlayerForAlerts[]): Alert[] {
  const alerts: Alert[] = []

  for (const player of players) {
    if (player.status !== 'active') continue

    const s = player.stats2m
    const wc = player.wcStats
    const pos = player.position as keyof typeof BENCHMARKS.shotsOnTarget

    // ── Stat base: prefiere WC si tiene suficientes partidos ──────────────
    const baseMatches = wc && wc.matches >= 2 ? wc.matches : s?.matches ?? 0
    const baseSoT     = wc && wc.matches >= 2 ? wc.shotsOnTarget  : s?.shotsOnTarget  ?? 0
    const baseFouls   = wc && wc.matches >= 2 ? wc.foulsCommitted : s?.foulsCommitted ?? 0
    const baseYellow  = wc && wc.matches >= 2 ? wc.yellowCards    : s?.yellowCards    ?? 0
    const baseTackles = wc && wc.matches >= 2 ? wc.tackles        : s?.tackles        ?? 0
    const baseGoals   = wc && wc.matches >= 2 ? wc.goals          : s?.goals          ?? 0
    const baseAssists = wc && wc.matches >= 2 ? wc.assists        : s?.assists        ?? 0

    if (baseMatches === 0) continue

    const sotPerMatch    = baseSoT     / baseMatches
    const foulsPerMatch  = baseFouls   / baseMatches
    const tacklesPerMatch= baseTackles / baseMatches
    const goalsPerMatch  = baseGoals   / baseMatches
    const assistsPerMatch= baseAssists / baseMatches

    // ── 1. HIGH_SHOTS ────────────────────────────────────────────────────
    const sotBench = BENCHMARKS.shotsOnTarget[pos] ?? 0.5
    if (sotPerMatch > sotBench * 1.5 && pos !== 'GK') {
      const excess = sotPerMatch / sotBench
      alerts.push({
        type: 'HIGH_SHOTS',
        playerId: player.id,
        playerName: player.name,
        country: player.country,
        flag: player.flag,
        position: pos,
        confidence: excess > 2.5 ? 'HIGH' : excess > 1.8 ? 'MEDIUM' : 'LOW',
        betMarket: 'Tiro al arco',
        description: `${(sotPerMatch).toFixed(1)} tiros al arco/partido vs promedio ${sotBench.toFixed(1)} para su posición`,
        value: sotPerMatch,
        benchmark: sotBench,
        unit: 'tiros al arco/partido',
      })
    }

    // ── 2. FOUL_MACHINE ──────────────────────────────────────────────────
    const foulBench = BENCHMARKS.foulsCommitted[pos] ?? 1.5
    if (foulsPerMatch > foulBench * 1.4) {
      const excess = foulsPerMatch / foulBench
      alerts.push({
        type: 'FOUL_MACHINE',
        playerId: player.id,
        playerName: player.name,
        country: player.country,
        flag: player.flag,
        position: pos,
        confidence: excess > 2 ? 'HIGH' : excess > 1.6 ? 'MEDIUM' : 'LOW',
        betMarket: 'Falta cometida / Amarilla',
        description: `${foulsPerMatch.toFixed(1)} faltas/partido (promedio ${foulBench.toFixed(1)})`,
        value: foulsPerMatch,
        benchmark: foulBench,
        unit: 'faltas/partido',
      })
    }

    // ── 3. YELLOW_PRONE ──────────────────────────────────────────────────
    if (baseMatches >= 3) {
      const yellowEvery = baseMatches / Math.max(baseYellow, 0.1)
      if (yellowEvery < BENCHMARKS.yellowRate * 0.6) {
        alerts.push({
          type: 'YELLOW_PRONE',
          playerId: player.id,
          playerName: player.name,
          country: player.country,
          flag: player.flag,
          position: pos,
          confidence: yellowEvery < 3 ? 'HIGH' : yellowEvery < 5 ? 'MEDIUM' : 'LOW',
          betMarket: 'Amarilla',
          description: `1 amarilla cada ${yellowEvery.toFixed(0)} partidos (promedio: cada ${BENCHMARKS.yellowRate})`,
          value: yellowEvery,
          benchmark: BENCHMARKS.yellowRate,
          unit: 'partidos por amarilla',
        })
      }
    }

    // ── 4. YELLOW_RISK (ya tiene amarilla en este mundial) ───────────────
    if (wc && wc.yellowCards >= 1 && wc.matches >= 1) {
      alerts.push({
        type: 'YELLOW_RISK',
        playerId: player.id,
        playerName: player.name,
        country: player.country,
        flag: player.flag,
        position: pos,
        confidence: 'MEDIUM',
        betMarket: 'Amarilla',
        description: `Tiene ${wc.yellowCards} amarilla(s) en el Mundial — otra lo suspende`,
        value: wc.yellowCards,
        benchmark: 1,
        unit: 'amarillas en el Mundial',
      })
    }

    // ── 5. ATTACKING_DEF ─────────────────────────────────────────────────
    // Defensor con goles destacados
    if (pos === 'DEF' && goalsPerMatch > 0.15) {
      alerts.push({
        type: 'ATTACKING_DEF',
        playerId: player.id,
        playerName: player.name,
        country: player.country,
        flag: player.flag,
        position: pos,
        confidence: goalsPerMatch > 0.25 ? 'HIGH' : 'MEDIUM',
        betMarket: 'Goleador (cuota alta)',
        description: `Defensor con ${(goalsPerMatch * 10).toFixed(1)} goles c/10 partidos — cuotas ofensivas altas`,
        value: goalsPerMatch,
        benchmark: 0.08,
        unit: 'goles/partido',
      })
    }
    // Mediocampista con asistencias destacadas (requiere asistencias reales, no goles)
    if (pos === 'MID' && assistsPerMatch > 0.25) {
      alerts.push({
        type: 'ATTACKING_DEF',
        playerId: player.id,
        playerName: player.name,
        country: player.country,
        flag: player.flag,
        position: pos,
        confidence: assistsPerMatch > 0.4 ? 'HIGH' : 'MEDIUM',
        betMarket: 'Dar asistencia',
        description: `Mediocampista con ${(assistsPerMatch * 10).toFixed(1)} asistencias c/10 partidos`,
        value: assistsPerMatch,
        benchmark: 0.2,
        unit: 'asistencias/partido',
      })
    }

    // ── 6. DEFENSIVE_FWD ─────────────────────────────────────────────────
    const tackleBenchFwd = BENCHMARKS.tackles.FWD
    if (pos === 'FWD' && tacklesPerMatch > tackleBenchFwd * 2) {
      alerts.push({
        type: 'DEFENSIVE_FWD',
        playerId: player.id,
        playerName: player.name,
        country: player.country,
        flag: player.flag,
        position: pos,
        confidence: 'LOW',
        betMarket: 'Entrada',
        description: `Delantero con ${tacklesPerMatch.toFixed(1)} entradas/partido (doble del promedio de delanteros)`,
        value: tacklesPerMatch,
        benchmark: tackleBenchFwd,
        unit: 'entradas/partido',
      })
    }

    // ── 7. WC_HOT_STREAK ─────────────────────────────────────────────────
    if (wc && wc.matches >= 2 && s && s.matches >= 3) {
      const wcRating = wc.rating
      const clubRating = s.rating
      if (wcRating > clubRating + 0.5) {
        alerts.push({
          type: 'WC_HOT_STREAK',
          playerId: player.id,
          playerName: player.name,
          country: player.country,
          flag: player.flag,
          position: pos,
          confidence: wcRating - clubRating > 1 ? 'HIGH' : 'MEDIUM',
          betMarket: 'Tiro al arco',
          description: `Rating ${wcRating.toFixed(1)} en el Mundial vs ${clubRating.toFixed(1)} en su club — en racha`,
          value: wcRating,
          benchmark: clubRating,
          unit: 'rating',
        })
      }
    }

    // ── 8. UNDERPERFORMING ───────────────────────────────────────────────
    if (wc && wc.matches >= 2 && s && s.matches >= 3) {
      const wcRating = wc.rating
      const clubRating = s.rating
      const wcGoalRate = wc.goals / wc.matches
      const clubGoalRate = s.goals / s.matches
      if (clubRating > 7.5 && wcRating < clubRating - 0.7 && pos === 'FWD') {
        alerts.push({
          type: 'UNDERPERFORMING',
          playerId: player.id,
          playerName: player.name,
          country: player.country,
          flag: player.flag,
          position: pos,
          confidence: wcGoalRate < clubGoalRate * 0.3 ? 'MEDIUM' : 'LOW',
          betMarket: 'Tiro al arco',
          description: `Estrella rindiendo por debajo: ${wcRating.toFixed(1)} vs ${clubRating.toFixed(1)} en club — puede explotar`,
          value: wcRating,
          benchmark: clubRating,
          unit: 'rating',
        })
      }
    }
  }

  // Ordenar por confianza
  const order = { HIGH: 0, MEDIUM: 1, LOW: 2 }
  return alerts.sort((a, b) => order[a.confidence] - order[b.confidence])
}
