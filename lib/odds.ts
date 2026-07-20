// Estimación de cuotas basada en probabilidad estadística + margen de casa

const BOOKMAKER_MARGIN = 0.10 // 10% margen típico

// Convierte probabilidad real a cuota decimal con margen
function toOdds(probability: number): number {
  const capped = Math.min(Math.max(probability, 0.05), 0.95)
  return Math.round(((1 / capped) * (1 - BOOKMAKER_MARGIN * 0.5)) * 100) / 100
}

// Probabilidad de que un jugador logre N+ de una stat en un partido
// Usando distribución de Poisson (lambda = promedio por partido)
function poissonProb(lambda: number, minN: number): number {
  if (lambda <= 0) return 0
  // P(X >= minN) = 1 - P(X < minN)
  let pLess = 0
  let term = Math.exp(-lambda)
  for (let k = 0; k < minN; k++) {
    pLess += term
    term *= lambda / (k + 1)
  }
  return Math.max(0, 1 - pLess)
}

export interface EstimatedOdds {
  line: string
  probability: number
  odds: number
}

// Estima cuotas para mercados de jugador basado en sus stats
export function estimatePlayerOdds(
  marketId: string,
  perGameAvg: number,  // promedio por partido de la stat relevante
  position: string
): EstimatedOdds {
  switch (marketId) {
    case 'player_shot_on_target': {
      // Línea: 1+ tiros al arco
      const prob = poissonProb(perGameAvg, 1)
      return { line: '1+ tiros al arco', probability: prob, odds: toOdds(prob) }
    }
    case 'player_shot_any': {
      const line = position === 'FWD' || position === 'MID' ? 2 : 1
      const prob = poissonProb(perGameAvg, line)
      return { line: `${line}+ tiros totales`, probability: prob, odds: toOdds(prob) }
    }
    case 'player_yellow_card': {
      // 1 amarilla = prob baja, cuota alta
      const prob = poissonProb(perGameAvg, 1)
      return { line: '1+ tarjeta amarilla', probability: prob, odds: toOdds(prob) }
    }
    case 'player_foul_committed': {
      // Línea dinámica según promedio
      const line = perGameAvg >= 2.5 ? 3 : perGameAvg >= 1.5 ? 2 : 1
      const prob = poissonProb(perGameAvg, line)
      return { line: `${line}+ faltas cometidas`, probability: prob, odds: toOdds(prob) }
    }
    case 'player_tackle': {
      const line = perGameAvg >= 3 ? 3 : 2
      const prob = poissonProb(perGameAvg, line)
      return { line: `${line}+ tackles`, probability: prob, odds: toOdds(prob) }
    }
    case 'player_foul_drawn': {
      const prob = poissonProb(perGameAvg, 1)
      return { line: '1+ foul recibido', probability: prob, odds: toOdds(prob) }
    }
    default:
      return { line: '-', probability: 0.5, odds: 2.0 }
  }
}

// Estima cuotas para mercados de partido
export function estimateMatchOdds(
  marketId: string,
  homeAvg: number,
  awayAvg: number
): EstimatedOdds {
  const combined = homeAvg + awayAvg

  switch (marketId) {
    case 'match_corners': {
      // Líneas comunes: over 8.5, 9.5, 10.5
      const line = combined >= 12 ? 10.5 : combined >= 9 ? 9.5 : 8.5
      const prob = poissonProb(combined, Math.ceil(line))
      return { line: `over ${line} corners`, probability: prob, odds: toOdds(prob) }
    }
    case 'match_yellow_cards': {
      const line = combined >= 5 ? 4.5 : combined >= 3.5 ? 3.5 : 2.5
      const prob = poissonProb(combined, Math.ceil(line))
      return { line: `over ${line} amarillas`, probability: prob, odds: toOdds(prob) }
    }
    case 'match_goals': {
      const line = combined >= 3.5 ? 2.5 : 1.5
      const prob = poissonProb(combined, Math.ceil(line))
      return { line: `over ${line} goles`, probability: prob, odds: toOdds(prob) }
    }
    default:
      return { line: '-', probability: 0.5, odds: 2.0 }
  }
}

// Intenta obtener cuotas reales de API-Football (mercados de partido)
export async function fetchRealOdds(
  fixtureExternalId: string
): Promise<Record<string, number> | null> {
  const API_KEY = process.env.FOOTBALL_API_KEY ?? ''
  if (!API_KEY) return null

  try {
    const res = await fetch(
      `https://v3.football.api-sports.io/odds?fixture=${fixtureExternalId}&bookmaker=8`,
      { headers: { 'x-apisports-key': API_KEY }, signal: AbortSignal.timeout(8000) }
    )
    const data = await res.json()
    const bets: Record<string, number> = {}

    for (const bookmaker of data?.response?.[0]?.bookmakers ?? []) {
      for (const market of bookmaker.bets ?? []) {
        for (const value of market.values ?? []) {
          const key = `${market.name}::${value.value}`
          bets[key] = parseFloat(value.odd)
        }
      }
    }
    return Object.keys(bets).length > 0 ? bets : null
  } catch {
    return null
  }
}
