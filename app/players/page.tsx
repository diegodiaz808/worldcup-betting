'use client'

import { useEffect, useState } from 'react'

const posLabel: Record<string, string> = { GK: 'ARQ', DEF: 'DEF', MID: 'MED', FWD: 'DEL' }

interface RankingPlayer {
  id: string
  name: string
  country: string
  flag: string
  position: string
  value: number
  matches: number
  perMatch: number
}

interface RankingBoard {
  key: string
  label: string
  players: RankingPlayer[]
}

interface WorldCupTrend {
  id: string
  name: string
  country: string
  flag: string
  position: string
  label: string
  baselinePerMatch: number
  worldCupPerMatch: number
  worldCupTotal: number
  matches: number
  change: number
  summary: string
}

interface PlayerBoardsResponse {
  boards: RankingBoard[]
  surprises: WorldCupTrend[]
  dropOffs: WorldCupTrend[]
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg p-4 text-sm" style={{ background: 'var(--surface2)', color: 'var(--text-dim)' }}>
      {text}
    </div>
  )
}

function Board({ board }: { board: RankingBoard }) {
  return (
    <section className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <h2 className="bebas text-2xl mb-4">{board.label}</h2>
      {board.players.length === 0 ? (
        <EmptyState text="Todavia no hay datos del Mundial para este ranking." />
      ) : (
        <div className="space-y-2">
          {board.players.map((player, idx) => (
            <div
              key={player.id}
              className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 py-2"
              style={{ borderBottom: idx === board.players.length - 1 ? 'none' : '1px solid var(--border)' }}
            >
              <div className="bebas text-xl text-center" style={{ color: 'var(--green)' }}>{idx + 1}</div>
              <div className="min-w-0">
                <div className="font-semibold truncate">{player.flag} {player.name}</div>
                <div className="text-xs truncate" style={{ color: 'var(--text-dim)' }}>
                  {player.country} · {posLabel[player.position] ?? player.position} · {player.matches} PJ
                </div>
              </div>
              <div className="text-right">
                <div className="bebas text-2xl" style={{ color: 'var(--green)' }}>{player.value}</div>
                <div className="text-xs" style={{ color: 'var(--text-dim)' }}>{player.perMatch}/pj</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function TrendList({ title, items, tone }: { title: string; items: WorldCupTrend[]; tone: 'up' | 'down' }) {
  const color = tone === 'up' ? 'var(--green)' : 'var(--amber)'

  return (
    <section>
      <h2 className="bebas text-2xl mb-3">{title}</h2>
      {items.length === 0 ? (
        <EmptyState text="Necesita al menos 2 partidos jugados para detectar cambios fuertes contra el promedio." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold truncate">{item.flag} {item.name}</h3>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>
                    {item.country} · {posLabel[item.position] ?? item.position} · {item.label}
                  </p>
                </div>
                <div className="bebas text-2xl shrink-0" style={{ color }}>{item.change}x</div>
              </div>
              <p className="text-sm mt-3 leading-relaxed" style={{ color: 'var(--text-dim)' }}>{item.summary}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export default function PlayersPage() {
  const [data, setData] = useState<PlayerBoardsResponse | null>(null)

  useEffect(() => {
    fetch('/api/worldcup/insights?view=players&limit=10')
      .then((r) => r.json())
      .then(setData)
  }, [])

  return (
    <div className="space-y-8">
      <header>
        <h1 className="bebas text-4xl md:text-5xl" style={{ color: 'var(--green)' }}>
          Jugadores
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>
          Rankings top 10 del Mundial y cambios fuertes contra el promedio reciente.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {(data?.boards ?? []).map((board) => <Board key={board.key} board={board} />)}
      </div>

      <TrendList title="Sorpresas del Mundial" items={data?.surprises ?? []} tone="up" />
      <TrendList title="Por debajo del promedio" items={data?.dropOffs ?? []} tone="down" />
    </div>
  )
}
