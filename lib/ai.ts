import Groq from 'groq-sdk'
import type { Alert } from './alerts'
import { MARKETS_FOR_PROMPT } from './markets'
import { estimatePlayerOdds, estimateMatchOdds } from './odds'

const client = new Groq({ apiKey: process.env.GROQ_API_KEY })

// ─── Tipos públicos ────────────────────────────────────────────────────────────

export interface SimplePick {
  player: string         // nombre del jugador o "Partido"
  marketId: string
  marketLabel: string
  line: string
  odds: number           // cuota estimada
  probability: number    // probabilidad implícita
  confidenceScore: number  // 0-100 basado en stats
  statBacking: string
  whyItWorks: string
  scope: 'player' | 'match'
}

export interface ComboProfile {
  id: string
  name: string
  description: string
  riskLevel: 'CONSERVADOR' | 'BALANCEADO' | 'ARRIESGADO' | 'PARLAY'
  picks: SimplePick[]
  totalOdds: number
  combinedScore: number    // promedio ponderado de scores individuales
  estimatedProbability: number
}

interface PlayerInput {
  name: string; country: string; club: string; position: string
  starterRate: number; weightedScore: number
  goals2m: number; assists2m: number; rating2m: number
  fouls2m: number; foulsDrawn2m: number; yellow2m: number; sot2m: number
  shotsTotal2m: number; matches2m: number; tackles2m: number
  goals6m: number; assists6m: number; rating6m: number
  wcGoals: number; wcYellow: number; wcMatches: number; wcRating: number
  wcSot: number; wcFouls: number; wcFoulsDrawn: number; wcTackles: number
}

interface TeamContext {
  country: string; flag: string; matches: number
  goalsForPerMatch: number; goalsAgainstPerMatch: number
  cornersPerMatch: number; yellowsPerMatch: number
  offsidesPerMatch: number; shotsPerMatch: number
  possession: number
}

// ─── Generación de picks simples ──────────────────────────────────────────────

export async function generateSimplePicks(
  players: PlayerInput[],
  alerts: Alert[],
  matchName: string,
  teamStats?: { home: TeamContext | null; away: TeamContext | null },
  marketAccuracy?: { marketId: string; hitRate: number; roi: number }[]
): Promise<SimplePick[]> {

  const accuracyNote = marketAccuracy && marketAccuracy.length > 0
    ? `\nRENDIMIENTO HISTÓRICO DEL SISTEMA (usalo para priorizar mercados que funcionan):\n` +
      marketAccuracy.map((m) => `  ${m.marketId}: ${(m.hitRate * 100).toFixed(0)}% hit, ROI ${(m.roi * 100).toFixed(0)}%`).join('\n')
    : ''

  const playerSummary = players
    .map((p, i) =>
      `${i + 1}. ${p.name} (${p.country}, ${p.position}, titular:${Math.round(p.starterRate * 100)}%) ` +
      `Club 2m(${p.matches2m}pj): ${p.goals2m}G ${p.sot2m}SoT ${p.fouls2m}faltas ${p.foulsDrawn2m}recibidas ${p.yellow2m}AMA ${p.tackles2m}tackles | ` +
      `WC(${p.wcMatches}pj): ${p.wcGoals}G ${p.wcSot}SoT ${p.wcFouls}faltas ${p.wcFoulsDrawn}recibidas ${p.wcYellow}AMA`
    )
    .join('\n')

  const alertSummary = alerts.slice(0, 20)
    .map((a) => `[${a.confidence}] ${a.playerName} (${a.position}): ${a.description} → ${a.betMarket}`)
    .join('\n')

  const teamCtx = teamStats
    ? [teamStats.home, teamStats.away].filter(Boolean).map((t) => t &&
        `${t.flag} ${t.country}(${t.matches}pj WC): corners/pj:${t.cornersPerMatch.toFixed(1)} ` +
        `amarillas/pj:${t.yellowsPerMatch.toFixed(1)} goles/pj:${t.goalsForPerMatch.toFixed(1)} ` +
        `tiros/pj:${t.shotsPerMatch.toFixed(1)} posesión:${t.possession.toFixed(0)}%`
      ).join(' | ')
    : ''

  const prompt = `Eres un analista de apuestas para el Mundial 2026.
Partido: ${matchName}
${teamCtx ? `Equipos: ${teamCtx}` : ''}
${accuracyNote}

JUGADORES (WC stats pesan más):
${playerSummary}

ALERTAS DETECTADAS:
${alertSummary || 'ninguna'}

MERCADOS DISPONIBLES:
${MARKETS_FOR_PROMPT}

Genera entre 8 y 15 apuestas simples e INDIVIDUALES. Cada una es UNA sola condición sobre UN jugador o el partido.
Devuelve SOLO un JSON array válido.

REGLAS DE CALIDAD:
- confidenceScore SOLO ≥ 60. Descartá picks débiles.
- statBacking: cita números reales de las stats provistas (ej: "2.3 SoT/pj en club, WC: 2.8")
- whyItWorks: 1-2 frases explicando la lógica estadística concreta
- line: condición exacta que debe cumplirse (ej: "2+ tiros al arco", "over 9.5 corners")
- PROHIBIDO: líneas triviales que casi siempre se cumplen
- Incluir 2-4 picks de partido (corners, amarillas, goles) si los datos de equipo lo justifican
- Variar entre jugadores de ambos equipos
- Priorizar mercados con buen historial del sistema si hay datos

JSON schema:
[{
  "player": "nombre o 'Partido'",
  "marketId": "player_shot_on_target",
  "marketLabel": "Tiro al arco",
  "line": "2+ tiros al arco",
  "confidenceScore": 74,
  "statBacking": "2.4 SoT/pj en club, WC: 3.1 en 2 partidos",
  "whyItWorks": "Consistentemente supera 2 tiros en partidos de alta intensidad, rival defensivamente frágil.",
  "scope": "player"
}]`

  const response = await client.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 3000,
    temperature: 0.55,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.choices[0]?.message?.content ?? ''
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) throw new Error(`No JSON: ${text.slice(0, 200)}`)

  const raw: Omit<SimplePick, 'odds' | 'probability'>[] = JSON.parse(jsonMatch[0])

  // Enriquecer con cuotas estimadas
  return raw
    .filter((p) => p.confidenceScore >= 60)
    .map((p) => {
      // Buscar jugador en el input para obtener su promedio
      const playerData = players.find((pl) => pl.name.toLowerCase().includes(p.player.toLowerCase().split(' ').pop() ?? ''))

      let est = { line: p.line, probability: 0.5, odds: 2.0 }

      if (p.scope === 'player' && playerData) {
        const statMap: Record<string, number> = {
          player_shot_on_target: playerData.wcMatches >= 2 ? playerData.wcSot / playerData.wcMatches : playerData.sot2m / Math.max(playerData.matches2m, 1),
          player_shot_any:       playerData.shotsTotal2m / Math.max(playerData.matches2m, 1),
          player_yellow_card:    playerData.wcMatches >= 2 ? playerData.wcYellow / playerData.wcMatches : playerData.yellow2m / Math.max(playerData.matches2m, 1),
          player_foul_committed: playerData.wcMatches >= 2 ? playerData.wcFouls / playerData.wcMatches : playerData.fouls2m / Math.max(playerData.matches2m, 1),
          player_tackle:         playerData.wcMatches >= 2 ? playerData.wcTackles / playerData.wcMatches : playerData.tackles2m / Math.max(playerData.matches2m, 1),
          player_foul_drawn:     playerData.wcMatches >= 2 ? playerData.wcFoulsDrawn / playerData.wcMatches : playerData.foulsDrawn2m / Math.max(playerData.matches2m, 1),
        }
        const avg = statMap[p.marketId] ?? 1
        est = estimatePlayerOdds(p.marketId, avg, playerData.position)
      } else if (p.scope === 'match' && teamStats) {
        const home = teamStats.home
        const away = teamStats.away
        const defGoals = 1.2; const defCorners = 5; const defYellow = 1.5
        const homeAvg = home ? (p.marketId === 'match_corners' ? home.cornersPerMatch : p.marketId === 'match_yellow_cards' ? home.yellowsPerMatch : home.goalsForPerMatch) : (p.marketId === 'match_corners' ? defCorners : p.marketId === 'match_yellow_cards' ? defYellow : defGoals)
        const awayAvg = away ? (p.marketId === 'match_corners' ? away.cornersPerMatch : p.marketId === 'match_yellow_cards' ? away.yellowsPerMatch : away.goalsForPerMatch) : (p.marketId === 'match_corners' ? defCorners : p.marketId === 'match_yellow_cards' ? defYellow : defGoals)
        est = estimateMatchOdds(p.marketId, homeAvg, awayAvg)
      }

      return {
        ...p,
        line: p.line || est.line,
        odds: est.odds,
        probability: est.probability,
      } as SimplePick
    })
    .sort((a, b) => b.confidenceScore - a.confidenceScore)
}

// ─── Constructor de combos a partir de picks simples ──────────────────────────

export function buildCombos(picks: SimplePick[]): ComboProfile[] {
  const viable = picks.filter((p) => p.confidenceScore >= 65).sort((a, b) => b.confidenceScore - a.confidenceScore)
  if (viable.length < 3) return []

  const combos: ComboProfile[] = []

  const profiles: { id: string; name: string; description: string; riskLevel: ComboProfile['riskLevel']; count: number; minScore: number }[] = [
    { id: 'conservador',  name: 'Conservador',   description: '3-4 picks de alta confianza. Cuota moderada, máxima consistencia.',         riskLevel: 'CONSERVADOR',  count: 3, minScore: 72 },
    { id: 'balanceado',   name: 'Balanceado',    description: '5-6 picks sólidos. Buen balance entre cuota y probabilidad de acierto.',    riskLevel: 'BALANCEADO',   count: 5, minScore: 67 },
    { id: 'arriesgado',   name: 'Arriesgado',    description: '7-8 picks mezclando alta y media confianza. Cuota alta, más incertidumbre.',riskLevel: 'ARRIESGADO',   count: 7, minScore: 63 },
    { id: 'parlay',       name: 'Parlay máximo', description: '9-10 picks, todo tipo de confianza. Paga mucho si sale, difícil de acertar.',riskLevel: 'PARLAY',       count: 9, minScore: 60 },
  ]

  for (const profile of profiles) {
    const candidates = viable.filter((p) => p.confidenceScore >= profile.minScore)
    if (candidates.length < profile.count) continue

    // Asegurar diversidad: no más de 3 del mismo jugador ni más de 2 del mismo mercado
    const selected: SimplePick[] = []
    const playerCount: Record<string, number> = {}
    const marketCount: Record<string, number> = {}

    for (const p of candidates) {
      if (selected.length >= profile.count) break
      const pCount = playerCount[p.player] ?? 0
      const mCount = marketCount[p.marketId] ?? 0
      if (pCount >= 2 || mCount >= 3) continue
      selected.push(p)
      playerCount[p.player] = pCount + 1
      marketCount[p.marketId] = mCount + 1
    }

    if (selected.length < 3) continue

    const totalOdds = selected.reduce((acc, p) => acc * p.odds, 1)
    const combinedScore = Math.round(selected.reduce((acc, p) => acc + p.confidenceScore, 0) / selected.length)
    const estimatedProb = selected.reduce((acc, p) => acc * p.probability, 1)

    combos.push({
      id: profile.id,
      name: profile.name,
      description: profile.description,
      riskLevel: profile.riskLevel,
      picks: selected,
      totalOdds: Math.round(totalOdds * 100) / 100,
      combinedScore,
      estimatedProbability: Math.round(estimatedProb * 1000) / 10,
    })
  }

  return combos
}

// ─── Compat: mantener generateCombos para no romper código existente ──────────
export type ComboSuggestion = ComboProfile & { picks: SimplePick[]; justification: string; edgeTip: string; marketInsight: string; realProbability: number; whyItWorks: string }

export async function generateCombos(
  topPlayers: PlayerInput[],
  alerts: Alert[] = [],
  matchName?: string,
  teamStats?: { home: TeamContext | null; away: TeamContext | null },
  marketAccuracy?: { marketId: string; hitRate: number; roi: number }[]
): Promise<ComboSuggestion[]> {
  const picks = await generateSimplePicks(topPlayers, alerts, matchName ?? '', teamStats, marketAccuracy)
  const combos = buildCombos(picks)
  return combos.map((c) => ({
    ...c,
    id: c.id,
    name: c.name,
    riskLevel: c.riskLevel as never,
    totalOdds: c.totalOdds,
    realProbability: c.estimatedProbability,
    confidenceScore: c.combinedScore,
    justification: c.description,
    whyItWorks: c.picks.map((p) => `${p.player}: ${p.whyItWorks}`).join(' | '),
    edgeTip: `Cuota combinada ${c.totalOdds.toFixed(2)}x — probabilidad estimada ${c.estimatedProbability}%`,
    marketInsight: '',
  }))
}
