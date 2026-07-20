'use client'
import { useEffect, useState } from 'react'
import PlayerCard from '@/components/PlayerCard'
import SyncButton from '@/components/SyncButton'

interface PlayerStats {
  id: string
  period: string
  goals: number
  assists: number
  matches: number
  rating: number
  goalsPerMatch: number
  shotsOnTarget: number
  weightedScore: number
}

interface Player {
  id: string
  name: string
  country: string
  club: string
  position: string
  flag: string
  weightedScore: number
  stats2m: PlayerStats | null
  stats6m: PlayerStats | null
}

export default function DashboardPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [position, setPosition] = useState('')
  const [sort, setSort] = useState('score')
  const [lastSync, setLastSync] = useState<string | null>(null)

  const fetchPlayers = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (position) params.set('position', position)
    if (sort) params.set('sort', sort)
    const res = await fetch(`/api/players?${params}`)
    const data = await res.json()
    setPlayers(data)
    setLoading(false)
  }

  const fetchSyncStatus = async () => {
    const res = await fetch('/api/sync')
    const data = await res.json()
    if (data?.createdAt) {
      setLastSync(new Date(data.createdAt).toLocaleTimeString())
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchPlayers()
    fetchSyncStatus()
  }, [position, sort])

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="bebas text-5xl md:text-7xl" style={{ color: 'var(--green)' }}>
            Player Intelligence
          </h1>
          <p style={{ color: 'var(--text-dim)' }} className="text-sm mt-1">
            FIFA World Cup 2026 — Weighted form analysis
          </p>
        </div>
        <SyncButton onSync={fetchPlayers} lastSync={lastSync} />
      </div>

      {/* Weight methodology bar */}
      <div
        className="rounded-xl p-4"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
            Score Weight Methodology
          </span>
          <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
            Rating ×0.4 + Goals/Match ×20×0.4 + SoT/Match ×0.2
          </span>
        </div>
        <div className="h-6 rounded-full overflow-hidden flex" style={{ background: 'var(--surface2)' }}>
          <div
            className="h-full flex items-center justify-center text-xs font-bold text-black"
            style={{ width: '65%', background: 'var(--green)' }}
          >
            Last 2 Months — 65%
          </div>
          <div
            className="h-full flex items-center justify-center text-xs font-medium"
            style={{ width: '35%', background: 'var(--gold-dim)', color: '#000' }}
          >
            Last 6 Months — 35%
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex gap-2">
          {['', 'FW', 'MF', 'DF'].map((pos) => (
            <button
              key={pos}
              onClick={() => setPosition(pos)}
              className="px-3 py-1.5 rounded text-sm font-medium transition-all"
              style={{
                background: position === pos ? 'var(--green)' : 'var(--surface)',
                color: position === pos ? '#000' : 'var(--text)',
                border: '1px solid var(--border)',
              }}
            >
              {pos || 'All'}
            </button>
          ))}
        </div>
        <div className="flex gap-2 ml-auto">
          <span className="text-xs self-center" style={{ color: 'var(--text-dim)' }}>Sort by:</span>
          {['score', 'goals', 'rating'].map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className="px-3 py-1.5 rounded text-sm transition-all capitalize"
              style={{
                background: sort === s ? 'var(--surface2)' : 'transparent',
                color: sort === s ? 'var(--green)' : 'var(--text-dim)',
                border: sort === s ? '1px solid var(--green)' : '1px solid var(--border)',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Player Grid */}
      {loading ? (
        <div className="text-center py-20" style={{ color: 'var(--text-dim)' }}>
          <div className="text-4xl mb-3">⚽</div>
          <p>Loading player data...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {players.map((player, idx) => (
            <PlayerCard key={player.id} player={player} rank={idx + 1} />
          ))}
        </div>
      )}
    </div>
  )
}
