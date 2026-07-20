'use client'

interface Pick {
  player: string
  market: string
  odds: number
  confidence: string
}

interface Combo {
  id: string
  name: string
  riskLevel: 'MODERADO' | 'ARRIESGADO' | 'MUY ARRIESGADO'
  totalOdds: number
  realProbability: number
  picks: Pick[]
  justification: string
  edgeTip: string
  marketInsight: string
  createdAt: string
}

const riskConfig = {
  MODERADO: {
    label: 'MODERADO',
    color: '#22c55e',
    bg: '#22c55e18',
    border: '#22c55e44',
    icon: '🟢',
  },
  ARRIESGADO: {
    label: 'ARRIESGADO',
    color: '#f97316',
    bg: '#f9731618',
    border: '#f9731644',
    icon: '🟠',
  },
  'MUY ARRIESGADO': {
    label: 'MUY ARRIESGADO',
    color: '#ef4444',
    bg: '#ef444418',
    border: '#ef444444',
    icon: '🔴',
  },
}

const confidenceColor = {
  HIGH: '#22c55e',
  MEDIUM: '#f59e0b',
  LOW: '#ef4444',
}

export default function ComboCard({ combo }: { combo: Combo }) {
  const risk = riskConfig[combo.riskLevel]
  const probability = Math.min(combo.realProbability, 100)

  return (
    <div
      className="rounded-xl overflow-hidden flex flex-col"
      style={{ background: 'var(--surface)', border: `1px solid ${risk.border}` }}
    >
      {/* Header */}
      <div
        className="p-4"
        style={{ background: risk.bg, borderBottom: `1px solid ${risk.border}` }}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="bebas text-xl leading-tight">{combo.name}</h3>
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
            style={{ background: risk.color + '33', color: risk.color, border: `1px solid ${risk.border}` }}
          >
            {risk.icon} {risk.label}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div>
            <div className="text-2xl bebas" style={{ color: 'var(--gold)' }}>
              {combo.totalOdds.toFixed(2)}x
            </div>
            <div className="text-xs" style={{ color: 'var(--text-dim)' }}>
              Total odds
            </div>
          </div>
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1">
              <span style={{ color: 'var(--text-dim)' }}>Real probability</span>
              <span style={{ color: risk.color }}>{combo.realProbability}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface2)' }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${probability}%`, background: risk.color }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Picks */}
      <div className="p-4 space-y-2 flex-1">
        <div className="text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--text-dim)' }}>
          Picks ({combo.picks.length})
        </div>
        {combo.picks.map((pick, idx) => (
          <div
            key={idx}
            className="rounded-lg p-3 flex items-center justify-between gap-2"
            style={{ background: 'var(--surface2)' }}
          >
            <div className="min-w-0">
              <div className="font-semibold text-sm truncate">{pick.player}</div>
              <div className="text-xs truncate" style={{ color: 'var(--text-dim)' }}>
                {pick.market}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span
                className="text-xs font-bold"
                style={{ color: confidenceColor[pick.confidence as keyof typeof confidenceColor] ?? 'var(--text-dim)' }}
              >
                {pick.confidence}
              </span>
              <span
                className="text-sm font-bold tabular-nums px-2 py-0.5 rounded"
                style={{ background: 'var(--gold)22', color: 'var(--gold)' }}
              >
                {pick.odds.toFixed(2)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Insights */}
      <div
        className="p-4 space-y-3"
        style={{ borderTop: '1px solid var(--border)', background: 'var(--surface2)' }}
      >
        <div>
          <div className="text-xs font-semibold mb-1" style={{ color: 'var(--gold)' }}>
            💡 Justification
          </div>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-dim)' }}>
            {combo.justification}
          </p>
        </div>
        <div>
          <div className="text-xs font-semibold mb-1" style={{ color: '#22c55e' }}>
            📈 Edge Tip
          </div>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-dim)' }}>
            {combo.edgeTip}
          </p>
        </div>
        {combo.marketInsight && (
          <div>
            <div className="text-xs font-semibold mb-1" style={{ color: '#3b82f6' }}>
              🌍 Market Insight
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-dim)' }}>
              {combo.marketInsight}
            </p>
          </div>
        )}
        <div className="text-right">
          <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
            {new Date(combo.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>
    </div>
  )
}
