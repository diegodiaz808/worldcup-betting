'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Match {
  id: string; homeTeam: string; awayTeam: string; homeFlag: string; awayFlag: string
  date: string; status: string; result: string | null; group: string; round: string
}
interface SystemSummary { totalBets: number; wonBets: number; hitRate: number; roi: number; totalProfit: number }
interface DailyStats { date: string; won: number; lost: number; hitRate: number; roi: number; aiInsight: string }
interface RankingPlayer {
  id: string; name: string; country: string; flag: string; position: string
  value: number; matches: number; perMatch: number
}
interface RankingBoard { label: string; players: RankingPlayer[] }
interface WorldCupTrend {
  id: string; name: string; country: string; flag: string; position: string
  label: string; baselinePerMatch: number; worldCupPerMatch: number; worldCupTotal: number
  matches: number; change: number; summary: string
}
interface WorldCupInsights {
  rankings: Record<string, RankingBoard>
  surprises: WorldCupTrend[]
  dropOffs: WorldCupTrend[]
}

function MatchCard({ match }: { match: Match }) {
  const isLive = match.status === 'live'
  const time = new Date(match.date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

  return (
    <Link href={`/matches/${match.id}`}>
      <div
        className="rounded-xl p-4 transition-all active:scale-[0.99] cursor-pointer"
        style={{
          background: 'var(--surface)',
          border: `1px solid ${isLive ? 'var(--red)' : 'var(--border)'}`,
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <span
            className="text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wider"
            style={{
              background: isLive ? '#e5393520' : 'var(--surface2)',
              color: isLive ? 'var(--red)' : 'var(--text-dim)',
            }}
          >
            {isLive ? 'En vivo' : match.status === 'finished' ? 'Finalizado' : time}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
            {match.group ? `Grupo ${match.group}` : match.round}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="text-center flex-1">
            <div className="text-3xl">{match.homeFlag}</div>
            <div className="text-sm font-semibold mt-1 leading-tight">{match.homeTeam}</div>
          </div>
          <div className="text-center px-2 shrink-0">
            {match.result
              ? <div className="bebas text-2xl" style={{ color: 'var(--green)' }}>{match.result}</div>
              : <div className="bebas text-xl" style={{ color: 'var(--text-dim)' }}>VS</div>}
          </div>
          <div className="text-center flex-1">
            <div className="text-3xl">{match.awayFlag}</div>
            <div className="text-sm font-semibold mt-1 leading-tight">{match.awayTeam}</div>
          </div>
        </div>

        <div className="mt-3 pt-3 text-center" style={{ borderTop: '1px solid var(--border)' }}>
          <span className="text-xs font-semibold" style={{ color: 'var(--green)' }}>
            {match.status === 'scheduled' ? 'Analizar partido →' : 'Ver análisis →'}
          </span>
        </div>
      </div>
    </Link>
  )
}

function SystemWidget({ summary, lastInsight }: { summary: SystemSummary; lastInsight: string }) {
  const roiColor = summary.roi >= 0 ? 'var(--green)' : 'var(--red)'
  const roiSign  = summary.roi >= 0 ? '+' : ''
  if (summary.totalBets === 0) return null
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="bebas text-lg tracking-wide">Rendimiento del sistema</h3>
        <Link href="/system" className="text-xs font-semibold" style={{ color: 'var(--green)' }}>Ver detalle →</Link>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-3">
        {[
          { label: 'Hit rate', value: `${(summary.hitRate * 100).toFixed(0)}%`, color: 'var(--green)' },
          { label: 'ROI',      value: `${roiSign}${(summary.roi * 100).toFixed(0)}%`, color: roiColor },
          { label: 'Aciertos', value: `${summary.wonBets}/${summary.totalBets}`, color: 'var(--text)' },
        ].map((s) => (
          <div key={s.label} className="text-center">
            <div className="bebas text-2xl" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs" style={{ color: 'var(--text-dim)' }}>{s.label}</div>
          </div>
        ))}
      </div>
      {lastInsight && (
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-dim)' }}>{lastInsight}</p>
      )}
    </div>
  )
}

function EmptyMiniState({ text }: { text: string }) {
  return (
    <div className="rounded-lg p-3 text-sm" style={{ background: 'var(--surface2)', color: 'var(--text-dim)' }}>
      {text}
    </div>
  )
}

function RankingCard({ board }: { board: RankingBoard }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <h3 className="bebas text-lg mb-3">{board.label}</h3>
      {board.players.length === 0 ? (
        <EmptyMiniState text="Todavia sin datos del Mundial." />
      ) : (
        <div className="space-y-2">
          {board.players.map((player, idx) => (
            <div key={player.id} className="flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <div className="font-semibold truncate">
                  <span style={{ color: 'var(--green)' }}>{idx + 1}.</span> {player.flag} {player.name}
                </div>
                <div className="text-xs truncate" style={{ color: 'var(--text-dim)' }}>
                  {player.country} · {player.position} · {player.matches} PJ
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="bebas text-xl" style={{ color: 'var(--green)' }}>{player.value}</div>
                <div className="text-xs" style={{ color: 'var(--text-dim)' }}>{player.perMatch}/pj</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TrendCard({ trend, tone }: { trend: WorldCupTrend; tone: 'up' | 'down' }) {
  const color = tone === 'up' ? 'var(--green)' : 'var(--amber)'
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold truncate">{trend.flag} {trend.name}</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>
            {trend.country} · {trend.position} · {trend.label}
          </p>
        </div>
        <div className="bebas text-2xl shrink-0" style={{ color }}>
          {trend.change}x
        </div>
      </div>
      <p className="text-sm mt-3 leading-relaxed" style={{ color: 'var(--text-dim)' }}>
        {trend.summary}
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {[
          { label: 'WC', value: trend.worldCupPerMatch },
          { label: 'Base', value: trend.baselinePerMatch },
          { label: 'Total', value: trend.worldCupTotal },
        ].map((item) => (
          <div key={item.label} className="rounded-lg py-2" style={{ background: 'var(--surface2)' }}>
            <div className="font-bold text-sm">{item.value}</div>
            <div className="text-xs" style={{ color: 'var(--text-dim)' }}>{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function WorldCupPulse({ insights }: { insights: WorldCupInsights | null }) {
  const boards = insights ? ['yellowCards', 'shotsOnTarget', 'goals', 'foulsCommitted', 'foulsDrawn'].map((key) => insights.rankings[key]).filter(Boolean) : []

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="bebas text-xl">Mundial al dia</h2>
          <p className="text-sm" style={{ color: 'var(--text-dim)' }}>
            Solo stats acumuladas en la Copa, separadas del historial de clubes.
          </p>
        </div>
        <Link href="/players" className="text-xs font-semibold shrink-0" style={{ color: 'var(--green)' }}>
          Ver top 10 →
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        {boards.map((board) => <RankingCard key={board.label} board={board} />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <h2 className="bebas text-xl mb-3">Sorpresas del Mundial</h2>
          <div className="grid grid-cols-1 gap-3">
            {!insights || insights.surprises.length === 0
              ? <EmptyMiniState text="Aparecen cuando un jugador supera fuerte su promedio despues de 2 partidos." />
              : insights.surprises.slice(0, 3).map((trend) => <TrendCard key={trend.id} trend={trend} tone="up" />)}
          </div>
        </div>
        <div>
          <h2 className="bebas text-xl mb-3">Por debajo del promedio</h2>
          <div className="grid grid-cols-1 gap-3">
            {!insights || insights.dropOffs.length === 0
              ? <EmptyMiniState text="Aparecen cuando un jugador importante baja mucho su produccion esperada." />
              : insights.dropOffs.slice(0, 3).map((trend) => <TrendCard key={trend.id} trend={trend} tone="down" />)}
          </div>
        </div>
      </div>
    </section>
  )
}

function AboutSection() {
  return (
    <div
      className="rounded-xl p-4 space-y-1"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <p className="text-sm" style={{ color: 'var(--text-dim)' }}>
        Hecha por <span style={{ color: 'var(--text)' }}>Diego Diaz</span> (acepta MercadoPete a modo de propina) - La app corre sobre Next.js, Prisma y estadísticas en tiempo real de API-Football.
      </p>
      <p className="text-sm" style={{ color: 'var(--text-dim)' }}>
        Cruza actualidad de jugadores, muestra del Mundial y dificultad del rival para estimar probabilidades con mercados definidos.
      </p>
      <p className="text-xs" style={{ color: 'var(--text-dim)', opacity: 0.6 }}>
        Las predicciones son estimaciones estadísticas, no garantías. La información se usa para orientar decisiones, no para reemplazar el criterio propio.
      </p>
    </div>
  )
}

export default function HomePage() {
  const [matches, setMatches] = useState<Match[]>([])
  const [system, setSystem] = useState<{ summary: SystemSummary; daily: DailyStats[] } | null>(null)
  const [insights, setInsights] = useState<WorldCupInsights | null>(null)
  const [showAbout, setShowAbout] = useState(false)

  useEffect(() => {
    fetch('/api/matches').then((r) => r.json()).then(setMatches)
    fetch('/api/system').then((r) => r.json()).then(setSystem)
    fetch('/api/worldcup/insights?limit=5').then((r) => r.json()).then(setInsights)
  }, [])

  const now = new Date()
  const todayMatches  = matches.filter((m) => new Date(m.date).toDateString() === now.toDateString())
  const liveMatches   = matches.filter((m) => m.status === 'live')
  const upcomingToday = todayMatches.filter((m) => m.status === 'scheduled')
  const lastInsight   = system?.daily?.[0]?.aiInsight ?? ''

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="bebas text-4xl" style={{ color: 'var(--green)' }}>
            CojeCasinos
          </h1>
          <p className="text-sm capitalize" style={{ color: 'var(--text-dim)' }}>
            {now.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          <button
            onClick={() => setShowAbout((v) => !v)}
            className="px-3 py-1.5 rounded text-xs font-semibold"
            style={{ background: 'var(--surface2)', color: 'var(--text-dim)', border: '1px solid var(--border)' }}
          >
            {showAbout ? 'Cerrar' : 'Acerca de'}
          </button>
        </div>
      </div>

      {showAbout && <AboutSection />}

      {system && <SystemWidget summary={system.summary} lastInsight={lastInsight} />}

      <WorldCupPulse insights={insights} />

      {/* En vivo */}
      {liveMatches.length > 0 && (
        <section>
          <h2 className="bebas text-xl mb-3" style={{ color: 'var(--red)' }}>En vivo</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {liveMatches.map((m) => <MatchCard key={m.id} match={m} />)}
          </div>
        </section>
      )}

      {/* Hoy */}
      {upcomingToday.length > 0 && (
        <section>
          <h2 className="bebas text-xl mb-3">
            Hoy{' '}
            <span style={{ color: 'var(--text-dim)' }}>
              - {upcomingToday.length} partido{upcomingToday.length > 1 ? 's' : ''}
            </span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {upcomingToday.map((m) => <MatchCard key={m.id} match={m} />)}
          </div>
        </section>
      )}

      {/* Sin partidos */}
      {todayMatches.length === 0 && liveMatches.length === 0 && (
        <div
          className="text-center py-14 rounded-xl"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <p className="font-semibold text-lg">Sin partidos hoy</p>
          <p className="text-sm mt-2" style={{ color: 'var(--text-dim)' }}>
            <Link href="/matches" style={{ color: 'var(--green)' }}>Ver todos los partidos →</Link>
          </p>
        </div>
      )}
    </div>
  )
}
