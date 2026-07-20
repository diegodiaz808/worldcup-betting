'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Match {
  id: string
  homeTeam: string
  awayTeam: string
  homeFlag: string
  awayFlag: string
  date: string
  result: string | null
  status: string
  round: string
  group: string
}

const statusConfig = {
  live:      { label: 'EN VIVO', color: '#ef4444', bg: '#ef444420' },
  scheduled: { label: 'PRÓXIMO', color: '#8888aa', bg: '#8888aa15' },
  finished:  { label: 'JUGADO',  color: '#22c55e', bg: '#22c55e15' },
}

function groupByDate(matches: Match[]) {
  const groups: Record<string, Match[]> = {}
  for (const m of matches) {
    const d = new Date(m.date).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
    groups[d] = groups[d] ?? []
    groups[d].push(m)
  }
  return groups
}

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'live' | 'scheduled' | 'finished'>('all')

  useEffect(() => {
    fetch('/api/matches')
      .then((r) => r.json())
      .then((data) => { setMatches(data); setLoading(false) })
  }, [])

  const filtered = filter === 'all' ? matches : matches.filter((m) => m.status === filter)
  const grouped = groupByDate(filtered)

  const counts = {
    live:      matches.filter((m) => m.status === 'live').length,
    scheduled: matches.filter((m) => m.status === 'scheduled').length,
    finished:  matches.filter((m) => m.status === 'finished').length,
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="bebas text-4xl" style={{ color: 'var(--green)' }}>
          Partidos
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>
          FIFA World Cup 2026 · Seleccioná un partido para ver alertas y combos
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'live', 'scheduled', 'finished'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-4 py-1.5 rounded-full text-sm font-semibold transition-all"
            style={{
              background: filter === f ? 'var(--green)' : 'var(--surface2)',
              color: filter === f ? '#0a0a0f' : 'var(--text-dim)',
              border: '1px solid',
              borderColor: filter === f ? 'var(--green)' : 'var(--border)',
            }}
          >
            {f === 'all' && `Todos (${matches.length})`}
            {f === 'live' && `En vivo (${counts.live})`}
            {f === 'scheduled' && `Próximos (${counts.scheduled})`}
            {f === 'finished' && `Jugados (${counts.finished})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20" style={{ color: 'var(--text-dim)' }}>
          <div className="text-4xl mb-3">⚽</div>
          <p>Cargando partidos...</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([date, dayMatches]) => (
            <div key={date}>
              <h2 className="bebas text-2xl mb-3 capitalize" style={{ color: 'var(--text-dim)' }}>
                {date}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {dayMatches.map((match) => {
                  const cfg = statusConfig[match.status as keyof typeof statusConfig] ?? statusConfig.scheduled
                  const isLive = match.status === 'live'
                  return (
                    <Link key={match.id} href={`/matches/${match.id}`}>
                      <div
                        className="rounded-xl p-4 transition-all hover:scale-[1.02] cursor-pointer"
                        style={{
                          background: isLive ? '#ef444410' : 'var(--surface)',
                          border: `1px solid ${isLive ? '#ef444444' : 'var(--border)'}`,
                        }}
                      >
                        {/* Status + round */}
                        <div className="flex items-center justify-between mb-3">
                          <span
                            className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ background: cfg.bg, color: cfg.color }}
                          >
                            {cfg.label}
                          </span>
                          <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
                            Grupo {match.group} · {match.round}
                          </span>
                        </div>

                        {/* Teams */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 text-right">
                            <div className="text-2xl">{match.homeFlag}</div>
                            <div className="font-semibold text-sm mt-1">{match.homeTeam}</div>
                          </div>

                          <div className="text-center px-3">
                            {match.result ? (
                              <div className="bebas text-3xl" style={{ color: 'var(--green)' }}>
                                {match.result}
                              </div>
                            ) : (
                              <div className="space-y-0.5">
                                <div className="bebas text-2xl" style={{ color: 'var(--text-dim)' }}>VS</div>
                                <div className="text-xs" style={{ color: 'var(--text-dim)' }}>
                                  {new Date(match.date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="flex-1 text-left">
                            <div className="text-2xl">{match.awayFlag}</div>
                            <div className="font-semibold text-sm mt-1">{match.awayTeam}</div>
                          </div>
                        </div>

                        {/* CTA */}
                        <div className="mt-3 text-center">
                          <span
                            className="text-xs font-semibold"
                            style={{ color: isLive ? '#ef4444' : 'var(--green)' }}
                          >
                            {isLive ? 'Ver en vivo →' : match.status === 'scheduled' ? 'Analizar →' : 'Ver análisis →'}
                          </span>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
