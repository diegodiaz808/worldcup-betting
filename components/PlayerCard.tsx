'use client'
import { useState } from 'react'

interface Stats {
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
  stats2m: Stats | null
  stats6m: Stats | null
}

const positionColors: Record<string, string> = {
  FW: '#ef4444',
  MF: '#3b82f6',
  DF: '#22c55e',
  GK: '#f59e0b',
}

function ScoreBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface2)' }}>
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, background: 'var(--gold)' }}
      />
    </div>
  )
}

export default function PlayerCard({ player, rank }: { player: Player; rank: number }) {
  const [expanded, setExpanded] = useState(false)
  const { stats2m, stats6m } = player

  return (
    <div
      className="rounded-xl overflow-hidden transition-all cursor-pointer"
      style={{
        background: 'var(--surface)',
        border: `1px solid ${expanded ? 'var(--gold)' : 'var(--border)'}`,
        boxShadow: expanded ? '0 0 20px rgba(255,210,0,0.1)' : 'none',
      }}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Card Header */}
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold bebas"
              style={{ background: 'var(--surface2)', color: 'var(--gold)' }}
            >
              {rank}
            </div>
            <div>
              <div className="font-semibold text-sm flex items-center gap-2">
                <span>{player.flag}</span>
                <span>{player.name}</span>
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>
                {player.club} · {player.country}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{
                background: positionColors[player.position] + '22',
                color: positionColors[player.position],
                border: `1px solid ${positionColors[player.position]}44`,
              }}
            >
              {player.position}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
              {expanded ? '▲' : '▼'}
            </span>
          </div>
        </div>

        {/* Score badge */}
        <div className="mt-3 flex items-center gap-3">
          <div>
            <div className="text-2xl bebas" style={{ color: 'var(--gold)' }}>
              {player.weightedScore.toFixed(2)}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-dim)' }}>
              Weighted Score
            </div>
          </div>
          <div className="flex-1">
            <ScoreBar value={player.weightedScore} max={15} />
          </div>
        </div>

        {/* Quick stats */}
        {stats2m && (
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              { label: 'Goals', value: stats2m.goals },
              { label: 'Assists', value: stats2m.assists },
              { label: 'Rating', value: stats2m.rating.toFixed(1) },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="rounded-lg py-2"
                style={{ background: 'var(--surface2)' }}
              >
                <div className="font-bold text-sm" style={{ color: 'var(--gold)' }}>
                  {value}
                </div>
                <div className="text-xs" style={{ color: 'var(--text-dim)' }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Expanded view */}
      {expanded && (
        <div
          className="border-t px-4 pb-4 pt-3"
          style={{ borderColor: 'var(--border)', background: 'var(--surface2)' }}
        >
          <div className="text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--text-dim)' }}>
            Period Comparison
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Last 2 Months', stats: stats2m, weight: '65%' },
              { label: 'Last 6 Months', stats: stats6m, weight: '35%' },
            ].map(({ label, stats, weight }) => (
              <div
                key={label}
                className="rounded-lg p-3"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold" style={{ color: 'var(--gold)' }}>
                    {label}
                  </span>
                  <span
                    className="text-xs px-1.5 py-0.5 rounded"
                    style={{ background: 'var(--gold)22', color: 'var(--gold)' }}
                  >
                    {weight}
                  </span>
                </div>
                {stats ? (
                  <div className="space-y-1.5 text-xs">
                    {[
                      ['⚽ Goals', stats.goals],
                      ['🅰️ Assists', stats.assists],
                      ['🎮 Matches', stats.matches],
                      ['⭐ Rating', stats.rating.toFixed(1)],
                      ['🎯 SoT', stats.shotsOnTarget],
                      ['📊 G/Match', stats.goalsPerMatch.toFixed(2)],
                    ].map(([key, val]) => (
                      <div key={String(key)} className="flex justify-between">
                        <span style={{ color: 'var(--text-dim)' }}>{key}</span>
                        <span className="font-medium">{val}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs" style={{ color: 'var(--text-dim)' }}>No data</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
