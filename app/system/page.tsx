'use client'

import { useEffect, useState } from 'react'
import { MARKET_BY_ID } from '@/lib/markets'

interface MarketAcc { marketId: string; total: number; won: number; hitRate: number; avgOdds: number; roi: number }
interface DailyStats { date: string; won: number; lost: number; hitRate: number; roi: number; aiInsight: string }
interface Summary {
  totalBets: number
  wonBets: number
  hitRate: number
  roi: number
  totalProfit: number
  totalStake: number
  totalSuggestions: number
  pendingSuggestions: number
}

export default function SystemPage() {
  const [data, setData] = useState<{ accuracy: MarketAcc[]; daily: DailyStats[]; summary: Summary } | null>(null)

  useEffect(() => {
    fetch('/api/system').then((r) => r.json()).then(setData)
  }, [])

  if (!data) return <div className="text-center py-20" style={{ color: 'var(--text-dim)' }}>Cargando...</div>

  const { accuracy, daily, summary } = data
  const roiColor = summary.roi >= 0 ? 'var(--green)' : 'var(--red)'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="bebas text-3xl">Sistema - Test de sugerencias</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>
          Auditoría interna de lo que el sistema sugirió. Stake simulado fijo de $1 por simple o combinada.
        </p>
      </div>

      {/* Resumen global */}
      <div className="rounded-xl p-4 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-xs mb-1" style={{ color: 'var(--text-dim)' }}>Sugerencias evaluadas</div>
            <div className="bebas text-2xl">${(summary.totalStake ?? 0).toFixed(2)}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>
              {summary.totalBets} evaluadas · {summary.pendingSuggestions ?? 0} pendientes
            </div>
          </div>
          <div style={{ borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
            <div className="text-xs mb-1" style={{ color: 'var(--text-dim)' }}>Resultado simulado</div>
            <div className="bebas text-2xl" style={{ color: roiColor }}>
              {(summary.totalProfit ?? 0) >= 0 ? '+' : ''}${(summary.totalProfit ?? 0).toFixed(2)}
            </div>
            <div className="text-xs mt-0.5" style={{ color: roiColor }}>
              ROI {summary.roi >= 0 ? '+' : ''}{(summary.roi * 100).toFixed(0)}%
            </div>
          </div>
          <div>
            <div className="text-xs mb-1" style={{ color: 'var(--text-dim)' }}>Acierto</div>
            <div className="bebas text-2xl" style={{ color: 'var(--green)' }}>{(summary.hitRate * 100).toFixed(0)}%</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>{summary.wonBets}/{summary.totalBets} testeadas</div>
          </div>
        </div>
        {summary.totalBets > 0 && (() => {
          const retorno = (summary.totalProfit ?? 0) + (summary.totalStake ?? 0)
          const ganado  = Math.max(0, retorno)
          const perdido = Math.max(0, (summary.totalStake ?? 0) - retorno)
          return (
            <div className="grid grid-cols-2 gap-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--text-dim)' }}>Retorno simulado</span>
                <span className="font-bold" style={{ color: 'var(--green)' }}>${ganado.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--text-dim)' }}>Stake perdido</span>
                <span className="font-bold" style={{ color: 'var(--red)' }}>-${perdido.toFixed(2)}</span>
              </div>
            </div>
          )
        })()}
      </div>

      {/* Precisión por mercado */}
      {accuracy.length > 0 && (
        <div>
          <h2 className="bebas text-xl mb-3">Test por mercado</h2>
          <div className="space-y-2">
            {accuracy.map((m) => {
              const label = MARKET_BY_ID[m.marketId]?.label ?? m.marketId
              const hitPct = Math.round(m.hitRate * 100)
              const roiPct = Math.round(m.roi * 100)
              const barColor = hitPct >= 60 ? 'var(--green)' : hitPct >= 45 ? '#f59e0b' : 'var(--red)'
              return (
                <div key={m.marketId} className="rounded-xl p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-semibold text-sm">{label}</span>
                    <div className="flex items-center gap-3 text-xs shrink-0">
                      <span style={{ color: 'var(--text-dim)' }}>{m.won}/{m.total} testeadas</span>
                      <span style={{ color: barColor }} className="font-bold">{hitPct}%</span>
                      <span style={{ color: roiPct >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        ROI {roiPct >= 0 ? '+' : ''}{roiPct}%
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: 'var(--surface2)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(hitPct, 100)}%`, background: barColor }} />
                  </div>
                  <div className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>
                    Cuota promedio: {m.avgOdds.toFixed(2)}x
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Historial diario */}
      {daily.length > 0 && (
        <div>
          <h2 className="bebas text-xl mb-3">Cierre diario</h2>
          <div className="space-y-3">
            {daily.map((d) => {
              const total = d.won + d.lost
              const color = d.hitRate >= 0.55 ? 'var(--green)' : d.hitRate >= 0.4 ? '#f59e0b' : 'var(--red)'
              return (
                <div key={d.date} className="rounded-xl p-4" style={{ background: 'var(--surface)', border: `1px solid ${color}33` }}>
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <span className="font-semibold">{new Date(d.date).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                    <div className="flex items-center gap-3 text-sm">
                      <span style={{ color }}>{Math.round(d.hitRate * 100)}% acierto</span>
                      <span style={{ color: d.roi >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        ROI {d.roi >= 0 ? '+' : ''}{Math.round(d.roi * 100)}%
                      </span>
                      <span style={{ color: 'var(--text-dim)' }}>{d.won}/{total}</span>
                    </div>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-dim)' }}>
                    Resultado del test con stake simulado de $1 por sugerencia evaluada.
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {accuracy.length === 0 && daily.length === 0 && (
        <div className="text-center py-16" style={{ color: 'var(--text-dim)' }}>
          
          <p className="font-semibold">Sin datos todavía</p>
          <p className="text-sm mt-1">El test empieza cuando se liquiden las primeras sugerencias del sistema.</p>
        </div>
      )}
    </div>
  )
}
