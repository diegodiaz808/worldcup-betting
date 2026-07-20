'use client'

import { useEffect, useState } from 'react'

interface Bet {
  id: string; matchName: string; player: string; marketLabel: string; line: string
  odds: number; stake: number; result: string; profit: number | null; createdAt: string
  comboId: string | null
}

const RC = { won: 'var(--green)', lost: 'var(--red)', pending: 'var(--amber)', void: 'var(--text-dim)' }
const RL = { won: 'Ganada', lost: 'Perdida', pending: 'Pendiente', void: 'Anulada' }

function BetRow({ bet, onSettle, onDelete }: {
  bet: Bet
  onSettle: (id: string, r: 'won' | 'lost' | 'void') => void
  onDelete: (id: string) => void
}) {
  const rc = RC[bet.result as keyof typeof RC] ?? 'var(--text-dim)'
  const profit = bet.profit ?? 0
  const isCombo = !!bet.comboId

  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: `1px solid var(--border)` }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span
              className="text-xs px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0"
              style={{ background: isCombo ? '#3b82f620' : 'var(--green-glow)', color: isCombo ? '#60a5fa' : 'var(--green)' }}
            >
              {isCombo ? 'Combinada' : 'Simple'}
            </span>
            <span className="text-xs truncate" style={{ color: 'var(--text-dim)' }}>{bet.matchName}</span>
          </div>
          <div className="font-semibold text-sm">{bet.player}</div>
          <div className="text-sm" style={{ color: 'var(--green)' }}>{bet.marketLabel} — {bet.line}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="bebas text-xl" style={{ color: 'var(--green)' }}>{bet.odds.toFixed(2)}x</div>
          <div className="text-xs" style={{ color: 'var(--text-dim)' }}>${bet.stake.toFixed(2)}</div>
        </div>
      </div>

      {/* Estado + profit */}
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-xs font-bold px-2 py-0.5 rounded"
          style={{ background: rc + '22', color: rc }}
        >
          {RL[bet.result as keyof typeof RL] ?? bet.result}
        </span>
        {bet.result !== 'pending' && bet.profit !== null && (
          <span className="text-sm font-bold" style={{ color: profit >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {profit >= 0 ? '+' : ''}${profit.toFixed(2)}
          </span>
        )}
      </div>

      {/* Acciones */}
      {bet.result === 'pending' && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => onSettle(bet.id, 'won')}
            className="flex-1 py-1.5 rounded text-xs font-bold"
            style={{ background: 'var(--green-glow)', color: 'var(--green)', border: '1px solid var(--green)' }}
          >
            Ganada
          </button>
          <button
            onClick={() => onSettle(bet.id, 'lost')}
            className="flex-1 py-1.5 rounded text-xs font-bold"
            style={{ background: '#e5393520', color: 'var(--red)', border: '1px solid var(--red)' }}
          >
            Perdida
          </button>
          <button
            onClick={() => onSettle(bet.id, 'void')}
            className="px-3 py-1.5 rounded text-xs"
            style={{ background: 'var(--surface2)', color: 'var(--text-dim)', border: '1px solid var(--border)' }}
          >
            Anular
          </button>
        </div>
      )}

      {bet.result !== 'pending' && (
        <button
          onClick={() => onDelete(bet.id)}
          className="mt-2 text-xs"
          style={{ color: 'var(--text-dim)' }}
        >
          Eliminar
        </button>
      )}
    </div>
  )
}

export default function BetsPage() {
  const [bets, setBets] = useState<Bet[]>([])
  const [filter, setFilter] = useState<'all' | 'pending' | 'won' | 'lost'>('all')

  useEffect(() => {
    fetch('/api/bets').then((r) => r.json()).then(setBets)
  }, [])

  async function settle(id: string, result: 'won' | 'lost' | 'void') {
    await fetch(`/api/bets/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ result }) })
    setBets((prev) => prev.map((b) => {
      if (b.id !== id) return b
      const profit = result === 'won' ? parseFloat(((b.stake * b.odds) - b.stake).toFixed(2)) : result === 'void' ? 0 : -b.stake
      return { ...b, result, profit }
    }))
  }

  async function deleteBet(id: string) {
    await fetch(`/api/bets/${id}`, { method: 'DELETE' })
    setBets((prev) => prev.filter((b) => b.id !== id))
  }

  const filtered  = bets.filter((b) => filter === 'all' || b.result === filter)
  const settled   = bets.filter((b) => b.result !== 'pending' && b.result !== 'void')
  const pending   = bets.filter((b) => b.result === 'pending')
  const wonBets   = settled.filter((b) => b.result === 'won')
  const lostBets  = settled.filter((b) => b.result === 'lost')

  const apostado  = bets.reduce((s, b) => s + b.stake, 0)
  const ganado    = wonBets.reduce((s, b) => s + (b.stake * b.odds), 0)
  const perdido   = lostBets.reduce((s, b) => s + b.stake, 0)
  const neto      = ganado - apostado + bets.filter((b) => b.result === 'void').reduce((s, b) => s + b.stake, 0)
  const hitRate   = settled.length > 0 ? Math.round(wonBets.length / settled.length * 100) : 0

  return (
    <div className="space-y-5">
      <h1 className="bebas text-3xl">Mis apuestas</h1>

      {/* Stats */}
      {bets.length > 0 && (
        <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs mb-1" style={{ color: 'var(--text-dim)' }}>Total apostado</div>
              <div className="bebas text-2xl">${apostado.toFixed(2)}</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>{bets.length} apuestas · {pending.length} pendientes</div>
            </div>
            <div>
              <div className="text-xs mb-1" style={{ color: 'var(--text-dim)' }}>Resultado neto</div>
              <div className="bebas text-2xl" style={{ color: neto >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {neto >= 0 ? '+' : ''}${neto.toFixed(2)}
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>
                {settled.length > 0 ? `${hitRate}% acierto` : 'Sin liquidar'}
              </div>
            </div>
          </div>
          {settled.length > 0 && (
            <div className="grid grid-cols-2 gap-3 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--text-dim)' }}>Ganado</span>
                <span className="font-bold text-sm" style={{ color: 'var(--green)' }}>+${ganado.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--text-dim)' }}>Perdido</span>
                <span className="font-bold text-sm" style={{ color: 'var(--red)' }}>-${perdido.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-1 rounded-xl p-1" style={{ background: 'var(--surface)' }}>
        {(['all', 'pending', 'won', 'lost'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{ background: filter === f ? 'var(--green)' : 'transparent', color: filter === f ? '#0a0a0f' : 'var(--text-dim)' }}>
            {f === 'all'     && `Todas (${bets.length})`}
            {f === 'pending' && `Pendientes (${bets.filter((b) => b.result === 'pending').length})`}
            {f === 'won'     && `Ganadas (${wonBets.length})`}
            {f === 'lost'    && `Perdidas (${lostBets.length})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-14 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="font-semibold">Sin apuestas acá todavía</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>
            Entrá a un partido, generá el análisis y guardá las que te gusten.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((b) => <BetRow key={b.id} bet={b} onSettle={settle} onDelete={deleteBet} />)}
        </div>
      )}
    </div>
  )
}
