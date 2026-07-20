// Mercados de apuesta disponibles, mapeados a las stats que los respaldan

export interface Market {
  id: string
  label: string           // nombre para mostrar en la UI
  description: string     // qué significa exactamente
  scope: 'player' | 'match'
  statKey: string | null  // campo en PlayerStats / TeamStats que lo respalda
  unit: string            // unidad para mostrar en alertas
  minGames: number        // mínimo de partidos para que la stat sea confiable
}

export const MARKETS: Market[] = [
  // ── Mercados de jugador ────────────────────────────────────────────────────
  {
    id: 'player_shot_on_target',
    label: 'Tiro al arco',
    description: 'El jugador realiza al menos 1 tiro que va entre los tres palos',
    scope: 'player',
    statKey: 'shotsOnTarget',
    unit: 'tiros al arco/partido',
    minGames: 3,
  },
  {
    id: 'player_shot_any',
    label: 'Tiro (al arco o afuera)',
    description: 'El jugador realiza al menos 1 tiro, independientemente de si va al arco',
    scope: 'player',
    statKey: 'shotsTotal',
    unit: 'tiros totales/partido',
    minGames: 3,
  },
  {
    id: 'player_yellow_card',
    label: 'Amarilla',
    description: 'El jugador recibe una tarjeta amarilla durante el partido',
    scope: 'player',
    statKey: 'yellowCards',
    unit: 'amarillas/partido',
    minGames: 5,
  },
  {
    id: 'player_foul_committed',
    label: 'Foul cometido',
    description: 'El jugador comete al menos N faltas en el partido',
    scope: 'player',
    statKey: 'foulsCommitted',
    unit: 'faltas cometidas/partido',
    minGames: 3,
  },
  {
    id: 'player_tackle',
    label: 'Entrada bien hecha',
    description: 'El jugador realiza al menos N tackles exitosos',
    scope: 'player',
    statKey: 'tackles',
    unit: 'tackles/partido',
    minGames: 3,
  },
  {
    id: 'player_foul_drawn',
    label: 'Le hacen foul',
    description: 'Al jugador le cometen al menos N faltas',
    scope: 'player',
    statKey: 'foulsDrawn',
    unit: 'fouls recibidos/partido',
    minGames: 3,
  },
  // ── Mercados de partido ────────────────────────────────────────────────────
  {
    id: 'match_corners',
    label: 'Corners en el partido',
    description: 'Total de corners del partido (over/under o número exacto)',
    scope: 'match',
    statKey: 'cornersPerMatch',
    unit: 'corners/partido',
    minGames: 2,
  },
  {
    id: 'match_yellow_cards',
    label: 'Amarillas en el partido',
    description: 'Total de tarjetas amarillas del partido (over/under)',
    scope: 'match',
    statKey: 'yellowsPerMatch',
    unit: 'amarillas/partido',
    minGames: 2,
  },
  {
    id: 'match_goals',
    label: 'Goles en el partido',
    description: 'Total de goles (over/under 2.5, ambos equipos marcan, etc.)',
    scope: 'match',
    statKey: 'goalsForPerMatch',
    unit: 'goles/partido',
    minGames: 2,
  },
]

export const MARKET_IDS = MARKETS.map((m) => m.id)

// Texto compacto para el prompt de la IA
export const MARKETS_FOR_PROMPT = MARKETS.map(
  (m) => `- ${m.id} → "${m.label}": ${m.description}`
).join('\n')

// Lookup rápido por id
export const MARKET_BY_ID = Object.fromEntries(MARKETS.map((m) => [m.id, m]))
