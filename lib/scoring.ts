export interface RawStats {
  goals: number
  assists: number
  matches: number
  rating: number
  shotsOnTarget: number
  foulsCommitted?: number
  yellowCards?: number
  tackles?: number
}

export interface ScoredStats extends RawStats {
  goalsPerMatch: number
  score: number
}

export interface WeightedPlayerScore {
  score2m: ScoredStats
  score6m: ScoredStats
  weightedScore: number
}

export function computeScore(stats: RawStats): ScoredStats {
  const goalsPerMatch = stats.matches > 0 ? stats.goals / stats.matches : 0
  const soTPerMatch = stats.matches > 0 ? stats.shotsOnTarget / stats.matches : 0
  const score = stats.rating * 0.4 + goalsPerMatch * 20 * 0.4 + soTPerMatch * 0.2
  return { ...stats, goalsPerMatch, score }
}

// Dynamic weighting: the more WC matches played, the more WC stats matter
export function computeWeightedScore(
  stats2m: RawStats,
  stats6m: RawStats,
  wcStats?: RawStats & { matches: number }
): WeightedPlayerScore {
  const scored2m = computeScore(stats2m)
  const scored6m = computeScore(stats6m)

  let weightedScore: number

  if (wcStats && wcStats.matches >= 3) {
    const wcScored = computeScore(wcStats)
    weightedScore = wcScored.score * 0.50 + scored2m.score * 0.35 + scored6m.score * 0.15
  } else if (wcStats && wcStats.matches >= 1) {
    const wcScored = computeScore(wcStats)
    weightedScore = wcScored.score * 0.30 + scored2m.score * 0.45 + scored6m.score * 0.25
  } else {
    weightedScore = scored2m.score * 0.65 + scored6m.score * 0.35
  }

  return { score2m: scored2m, score6m: scored6m, weightedScore }
}
