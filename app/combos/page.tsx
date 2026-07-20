'use client'
import { useEffect, useState } from 'react'
import ComboCard from '@/components/ComboCard'

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

export default function CombosPage() {
  const [combos, setCombos] = useState<Combo[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchCombos = async () => {
    setLoading(true)
    const res = await fetch('/api/combos')
    const data = await res.json()
    setCombos(data)
    setLoading(false)
  }

  const generateCombos = async () => {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/combos/generate', { method: 'POST' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Generation failed')
      }
      await fetchCombos()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setGenerating(false)
    }
  }

  useEffect(() => {
    fetchCombos()
  }, [])

  const todayCombos = combos.filter((c) => {
    const d = new Date(c.createdAt)
    const now = new Date()
    return d.toDateString() === now.toDateString()
  })

  const historyCombos = combos.filter((c) => !todayCombos.includes(c))

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="bebas text-5xl md:text-7xl" style={{ color: 'var(--green)' }}>
            AI Combo Generator
          </h1>
          <p style={{ color: 'var(--text-dim)' }} className="text-sm mt-1">
            Powered by Claude Opus — Top 8 players weighted analysis
          </p>
        </div>

        <button
          onClick={generateCombos}
          disabled={generating}
          className="relative flex items-center gap-3 px-6 py-3 rounded-xl text-base font-bold transition-all disabled:opacity-60 gold-glow"
          style={{
            background: generating ? 'var(--surface2)' : 'var(--green)',
            color: generating ? 'var(--text-dim)' : '#000',
          }}
        >
          {generating ? (
            <>
              <span className="animate-spin text-xl">⚙️</span>
              Generating Combos...
            </>
          ) : (
            <>
              <span className="text-xl">🤖</span>
              Generate New Combos
            </>
          )}
        </button>
      </div>

      {error && (
        <div
          className="rounded-xl p-4 text-sm"
          style={{ background: '#ef444422', border: '1px solid #ef4444', color: '#ef4444' }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* Info banner */}
      <div
        className="rounded-xl p-4 flex flex-col md:flex-row gap-3"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        {[
          { icon: '📊', label: 'Data Source', desc: 'Top 8 players by weighted score' },
          { icon: '🧠', label: 'AI Model', desc: 'Claude Opus 4.8 analysis' },
          { icon: '⚖️', label: 'Methodology', desc: '65/35 weighted form ratio' },
        ].map(({ icon, label, desc }) => (
          <div key={label} className="flex items-center gap-3 flex-1">
            <span className="text-2xl">{icon}</span>
            <div>
              <div className="text-xs font-semibold" style={{ color: 'var(--green)' }}>
                {label}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-dim)' }}>
                {desc}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Today's combos */}
      {loading ? (
        <div className="text-center py-20" style={{ color: 'var(--text-dim)' }}>
          <div className="text-4xl mb-3">🤖</div>
          <p>Loading combos...</p>
        </div>
      ) : todayCombos.length > 0 ? (
        <div>
          <h2 className="bebas text-3xl mb-4" style={{ color: 'var(--text)' }}>
            Today&apos;s Suggestions
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {todayCombos.map((combo) => (
              <ComboCard key={combo.id} combo={combo} />
            ))}
          </div>
        </div>
      ) : (
        <div
          className="text-center py-16 rounded-xl"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <div className="text-5xl mb-4">🎯</div>
          <p className="font-semibold mb-2">No combos generated yet</p>
          <p className="text-sm" style={{ color: 'var(--text-dim)' }}>
            Click &quot;Generate New Combos&quot; to get AI-powered betting suggestions
          </p>
        </div>
      )}

      {/* History */}
      {historyCombos.length > 0 && (
        <div>
          <h2 className="bebas text-3xl mb-4" style={{ color: 'var(--text-dim)' }}>
            Previous Combos
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 opacity-70">
            {historyCombos.slice(0, 9).map((combo) => (
              <ComboCard key={combo.id} combo={combo} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
