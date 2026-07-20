'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import type { Alert } from '@/lib/alerts'

interface PlayerStats {
  matches: number; goals: number; assists: number; rating: number
  shotsOnTarget: number; foulsCommitted: number; yellowCards: number; tackles: number
  passAccuracy: number; weightedScore: number
}
interface WCStats {
  matches: number; goals: number; assists: number; rating: number
  shotsOnTarget: number; foulsCommitted: number; yellowCards: number
}
interface Player {
  id: string; name: string; club: string; position: string; flag: string
  status: string; statusReason: string | null; starterRate: number
  stats2m: PlayerStats | null; wcStats: WCStats | null
}
interface LineupPlayer { id: number; name: string; number: number; position: string }
interface Match {
  id: string; homeTeam: string; awayTeam: string; homeFlag: string; awayFlag: string
  date: string; result: string | null; status: string; round: string; group: string
  lineupHome: LineupPlayer[] | null; lineupAway: LineupPlayer[] | null; lineupFetchedAt: string | null
}
interface MatchData { match: Match; home: Player[]; away: Player[]; alerts: Alert[] }

interface Pick { player: string; country?: string; flag?: string; marketId?: string; marketLabel?: string; market?: string; line?: string; odds: number; confidence?: string; statBacking?: string; confidenceScore?: number; whyItWorks?: string; probability?: number; scope?: string }
interface ComboProfile {
  id: string; name: string; description: string; riskLevel: string
  picks: Pick[]; totalOdds: number; combinedScore: number; estimatedProbability: number
}
// legacy compat
interface Combo {
  id: string; name: string; riskLevel: string; totalOdds: number
  realProbability: number; confidenceScore: number
  picks: Pick[]
  justification: string; whyItWorks: string; edgeTip: string; marketInsight: string
}

const posColor: Record<string, string> = { GK: '#64748b', DEF: 'var(--green-dim)', MID: '#8b5cf6', FWD: '#f59e0b' }
const posLabel: Record<string, string> = { GK: 'ARQ', DEF: 'DEF', MID: 'MED', FWD: 'DEL' }
const alertIcon: Record<string, string> = {
  HIGH_SHOTS: '🎯', FOUL_MACHINE: '👊', YELLOW_PRONE: '🟨', YELLOW_RISK: '⚠️',
  ATTACKING_DEF: '⚔️', DEFENSIVE_FWD: '🛡️', WC_HOT_STREAK: '🔥', UNDERPERFORMING: '💤',
}
const confColor = { HIGH: 'var(--green)', MEDIUM: '#f59e0b', LOW: '#8888aa' }

function StatusBadge({ status }: { status: string }) {
  if (status === 'active') return null
  const cfg = status === 'injured' ? { label: '🤕 Lesionado', c: 'var(--red)' } :
               status === 'suspended' ? { label: '🟥 Suspendido', c: '#f59e0b' } :
               { label: '✈️ Eliminado', c: '#8888aa' }
  return <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: cfg.c + '22', color: cfg.c }}>{cfg.label}</span>
}

function PlayerRow({ player, isStarter }: { player: Player; isStarter: boolean }) {
  const inactive = player.status !== 'active'
  return (
    <div
      className="flex items-center gap-3 p-2 rounded-lg"
      style={{ background: inactive ? '#ffffff05' : isStarter ? 'var(--surface2)' : 'transparent', opacity: inactive ? 0.5 : 1 }}
    >
      <span className="text-xs font-bold w-8 text-center rounded px-1"
        style={{ background: posColor[player.position] + '33', color: posColor[player.position] }}>
        {posLabel[player.position] ?? player.position}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm truncate">{player.name}</span>
          {isStarter && !inactive && <span className="text-xs" style={{ color: 'var(--green)' }}>★ Titular</span>}
          <StatusBadge status={player.status} />
        </div>
        <div className="text-xs truncate" style={{ color: 'var(--text-dim)' }}>{player.club}</div>
      </div>
      {player.wcStats && player.wcStats.matches > 0 && (
        <div className="text-right shrink-0">
          <div className="text-xs font-semibold" style={{ color: 'var(--green)' }}>
            {player.wcStats.goals}G {player.wcStats.assists}A
          </div>
          <div className="text-xs" style={{ color: 'var(--text-dim)' }}>
            {player.wcStats.matches}pj WC
          </div>
        </div>
      )}
      <div className="text-right shrink-0">
        <div className="text-xs" style={{ color: 'var(--text-dim)' }}>
          {Math.round(player.starterRate * 100)}%
        </div>
      </div>
    </div>
  )
}

function TeamColumn({ team, flag, players }: { team: string; flag: string; players: Player[] }) {
  const starters = players.filter((p) => p.starterRate >= 0.75 && p.status === 'active').slice(0, 11)
  const bench = players.filter((p) => !starters.includes(p))
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">{flag}</span>
        <h3 className="bebas text-xl">{team}</h3>
        <span className="text-xs ml-auto" style={{ color: 'var(--text-dim)' }}>% titularidad</span>
      </div>
      <div className="space-y-1 mb-4">
        <div className="text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--green)' }}>Probable XI</div>
        {starters.map((p) => <PlayerRow key={p.id} player={p} isStarter />)}
      </div>
      {bench.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--text-dim)' }}>Suplentes</div>
          {bench.map((p) => <PlayerRow key={p.id} player={p} isStarter={false} />)}
        </div>
      )}
    </div>
  )
}

function AlertCard({ alert }: { alert: Alert }) {
  const cc = confColor[alert.confidence]
  return (
    <div className="rounded-lg p-3" style={{ background: 'var(--surface2)', border: `1px solid ${cc}33` }}>
      <div className="flex items-start gap-3">
        <span className="text-xl shrink-0">{alertIcon[alert.type] ?? '📊'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-semibold text-sm">{alert.playerName}</span>
            <span className="text-sm">{alert.flag}</span>
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: posColor[alert.position] + '33', color: posColor[alert.position] }}>
              {posLabel[alert.position] ?? alert.position}
            </span>
            <span className="text-xs font-bold ml-auto" style={{ color: cc }}>
              {alert.confidence}
            </span>
          </div>
          <p className="text-xs mb-1" style={{ color: 'var(--text-dim)' }}>{alert.description}</p>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold" style={{ color: 'var(--green)' }}>Apuesta:</span>
            <span className="text-xs">{alert.betMarket}</span>
          </div>
        </div>
      </div>
    </div>
  )
}



function ConfirmedLineup({ team, flag, lineup }: { team: string; flag: string; lineup: LineupPlayer[] }) {
  const posOrder = ['G', 'D', 'M', 'F', 'A']
  const sorted = [...lineup].sort((a, b) => posOrder.indexOf(a.position[0]) - posOrder.indexOf(b.position[0]))
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--green)' }}>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">{flag}</span>
        <h3 className="bebas text-xl">{team}</h3>
        <span className="text-xs ml-auto px-2 py-0.5 rounded-full font-semibold" style={{ background: 'var(--green-glow)', color: 'var(--green)' }}>
          XI Confirmado
        </span>
      </div>
      <div className="space-y-1">
        {sorted.map((p) => (
          <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg" style={{ background: 'var(--surface2)' }}>
            <span className="text-xs font-bold w-6 text-center" style={{ color: 'var(--text-dim)' }}>#{p.number}</span>
            <span className="font-semibold text-sm">{p.name}</span>
            <span className="text-xs ml-auto" style={{ color: 'var(--text-dim)' }}>{posLabel[p.position] ?? p.position}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const riskMeta: Record<string, { color: string; label: string; dot: string }> = {
  SEGURA:      { color: 'var(--green)',  label: 'SEGURA',   dot: '#00b140' },
  MEDIA:       { color: '#f59e0b',       label: 'MEDIA',    dot: '#f59e0b' },
  AGRESIVA:    { color: 'var(--red)',    label: 'AGRESIVA', dot: '#e53935' },
  CONSERVADOR: { color: 'var(--green)',  label: 'SEGURA',   dot: '#00b140' },
  BALANCEADO:  { color: '#f59e0b',       label: 'MEDIA',    dot: '#f59e0b' },
  ARRIESGADO:  { color: 'var(--red)',    label: 'AGRESIVA', dot: '#e53935' },
  PARLAY:      { color: 'var(--red)',    label: 'AGRESIVA', dot: '#e53935' },
}
const normalizeRisk = (r: string): 'SEGURA' | 'MEDIA' | 'AGRESIVA' => {
  if (r === 'SEGURA' || r === 'CONSERVADOR') return 'SEGURA'
  if (r === 'AGRESIVA' || r === 'ARRIESGADO' || r === 'PARLAY') return 'AGRESIVA'
  return 'MEDIA'
}

function SimplePickCard({ pick }: { pick: Pick }) {
  const score = pick.confidenceScore ?? 0
  const scoreColor = score >= 75 ? 'var(--green)' : score >= 65 ? '#f59e0b' : '#8888aa'

  return (
    <div className="rounded-xl p-3" style={{ background: 'var(--surface)', border: `1px solid ${scoreColor}33` }}>
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center shrink-0 w-10">
          <div className="bebas text-xl leading-none" style={{ color: scoreColor }}>{score}</div>
          <div className="text-xs" style={{ color: scoreColor }}>score</div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {pick.flag && <span className="text-base leading-none">{pick.flag}</span>}
            <span className="font-semibold text-sm">{pick.player}</span>
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--surface2)', color: 'var(--green)' }}>
              {pick.marketLabel ?? pick.market}
            </span>
          </div>
          <div className="text-sm font-semibold mt-0.5" style={{ color: 'var(--green)' }}>{pick.line}</div>
          {pick.statBacking && (
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>{pick.statBacking}</div>
          )}
          {pick.whyItWorks && (
            <div className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>{pick.whyItWorks}</div>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className="bebas text-2xl" style={{ color: 'var(--green)' }}>{(pick.odds ?? 0).toFixed(2)}x</div>
          {pick.probability != null && (
            <div className="text-xs" style={{ color: 'var(--text-dim)' }}>{Math.round(pick.probability * 100)}% prob.</div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Ticket de combinada estilo betting slip ──────────────────────────────────
function BettingSlip({ combo }: { combo: ComboProfile }) {
  const meta = riskMeta[combo.riskLevel] ?? { color: '#8888aa', label: combo.riskLevel, dot: '#8888aa' }
  const [open, setOpen] = useState(true)

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#1a1a1a', border: `1px solid ${meta.color}55` }}>
      {/* Header del ticket */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: meta.color + '18', borderBottom: `1px solid ${meta.color}33` }}>
        <div className="flex items-center gap-2">
          <span className="bebas text-lg tracking-wider" style={{ color: meta.color }}>{combo.name}</span>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: meta.color + '25', color: meta.color }}>
            {meta.label}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <div className="bebas text-2xl leading-none" style={{ color: meta.color }}>{combo.totalOdds.toFixed(2)}</div>
            <div className="text-xs" style={{ color: 'var(--text-dim)' }}>cuota total</div>
          </div>
          <button onClick={() => setOpen(!open)} className="text-xs px-2 py-1 rounded" style={{ color: 'var(--text-dim)', background: 'var(--surface2)' }}>
            {open ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* Línea de stats rápidas */}
      <div className="px-4 py-2 flex items-center gap-5 text-xs" style={{ background: '#111', borderBottom: '1px solid var(--border)' }}>
        <div>
          <span style={{ color: 'var(--text-dim)' }}>Selecciones </span>
          <span className="font-bold">{combo.picks.length}</span>
        </div>
        <div>
          <span style={{ color: 'var(--text-dim)' }}>Score </span>
          <span className="font-bold" style={{ color: combo.combinedScore >= 70 ? 'var(--green)' : '#f59e0b' }}>{combo.combinedScore}/100</span>
        </div>
        <div>
          <span style={{ color: 'var(--text-dim)' }}>Prob. </span>
          <span className="font-bold">{combo.estimatedProbability}%</span>
        </div>
        <div className="ml-auto">
          <span style={{ color: 'var(--text-dim)' }}>Retorno x$1 </span>
          <span className="font-bold" style={{ color: 'var(--green)' }}>${combo.totalOdds.toFixed(2)}</span>
        </div>
      </div>

      {/* Lista de picks estilo ticket */}
      {open && (
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {combo.picks.map((pick, i) => {
            const pScore = pick.confidenceScore ?? 0
            const isHigh = pScore >= 75
            return (
              <div key={i} className="px-4 py-3 flex items-start gap-3">
                {/* Indicador */}
                <div className="mt-0.5 shrink-0">
                  {isHigh
                    ? <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'var(--green)' }}>
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4L3.5 6.5L9 1" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    : <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center" style={{ borderColor: 'var(--text-dim)' }}>
                        <div className="w-2 h-2 rounded-full" style={{ background: 'var(--text-dim)' }} />
                      </div>
                  }
                </div>

                {/* Info pick */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm leading-tight">
                    {pick.flag && <span className="mr-1">{pick.flag}</span>}{pick.player}: {pick.line}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>
                    {pick.marketLabel ?? pick.market}
                  </div>
                  {pick.statBacking && (
                    <div className="text-xs mt-1" style={{ color: '#666' }}>{pick.statBacking}</div>
                  )}
                </div>

                {/* Cuota individual */}
                <div className="shrink-0 text-right">
                  <div className="text-sm font-bold px-2 py-0.5 rounded" style={{ background: 'var(--surface2)', color: 'var(--green)' }}>
                    {(pick.odds ?? 0).toFixed(2)}
                  </div>
                  {pick.probability != null && (
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>{Math.round(pick.probability * 100)}%</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Footer: resumen de retorno */}
      {open && (
        <div className="px-4 py-3 flex items-center justify-between" style={{ background: '#111', borderTop: `1px solid ${meta.color}33` }}>
          <div className="text-xs" style={{ color: 'var(--text-dim)' }}>
            {combo.description}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sección de combinadas con tabs por cantidad de selecciones ───────────────
function ComboSection({ combos }: { combos: ComboProfile[] }) {
  // Agrupar por número de picks
  const byCount: Record<number, ComboProfile[]> = {}
  for (const c of combos) {
    const n = c.picks.length
    if (!byCount[n]) byCount[n] = []
    byCount[n].push(c)
  }
  const counts = Object.keys(byCount).map(Number).sort((a, b) => a - b)
  const [activeCount, setActiveCount] = useState(counts[0] ?? 2)
  const RISK_ORDER: Array<'SEGURA' | 'MEDIA' | 'AGRESIVA'> = ['SEGURA', 'MEDIA', 'AGRESIVA']

  if (counts.length === 0) return null

  const currentCombos = byCount[activeCount] ?? []

  return (
    <div>
      <h3 className="bebas text-xl mb-1">Combinadas</h3>
      <p className="text-xs mb-3" style={{ color: 'var(--text-dim)' }}>
        Organizadas por cantidad de selecciones. Dentro de cada ticket: Segura, Media, Agresiva.
      </p>

      {/* Tabs por cantidad de picks */}
      <div className="flex gap-1 mb-4 rounded-lg p-1" style={{ background: 'var(--surface)' }}>
        {counts.map((n) => (
          <button key={n} onClick={() => setActiveCount(n)}
            className="flex-1 py-2 rounded text-sm font-bold transition-all"
            style={{
              background: activeCount === n ? 'var(--green)' : 'transparent',
              color: activeCount === n ? '#000' : 'var(--text-dim)',
            }}>
            {n} selec.
            <span className="block text-xs font-normal" style={{ color: activeCount === n ? '#000a' : 'var(--text-dim)' }}>
              {byCount[n].length} combo{byCount[n].length !== 1 ? 's' : ''}
            </span>
          </button>
        ))}
      </div>

      {/* Dentro del tab: secciones SEGURA / MEDIA / AGRESIVA */}
      <div className="space-y-6">
        {RISK_ORDER.map((risk) => {
          const group = currentCombos.filter((c) => normalizeRisk(c.riskLevel) === risk)
          if (!group.length) return null
          const meta = riskMeta[risk]
          return (
            <div key={risk}>
              {/* Separador de riesgo */}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-2 h-2 rounded-full" style={{ background: meta.dot }} />
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: meta.color }}>{meta.label}</span>
                <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{group.length} combinada{group.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-3">
                {group.map((c) => <BettingSlip key={c.id} combo={c} />)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function MatchPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<MatchData | null>(null)
  const [tab, setTab] = useState<'lineup' | 'alerts' | 'picks'>('picks')
  const [picks, setPicks] = useState<Pick[]>([])
  const [combos, setCombos] = useState<ComboProfile[]>([])
  const [generating, setGenerating] = useState(false)
  const [picksLoaded, setPicksLoaded] = useState(false)

  useEffect(() => {
    fetch(`/api/matches/${id}`)
      .then((r) => r.json())
      .then(setData)
  }, [id])

  useEffect(() => {
    let cancelled = false
    setGenerating(true)
    fetch(`/api/matches/${id}/picks`, { method: 'POST' })
      .then((res) => res.json())
      .then((result) => {
        if (cancelled) return
        setPicks(result.picks ?? [])
        setCombos(result.combos ?? [])
        setPicksLoaded(true)
      })
      .finally(() => {
        if (!cancelled) setGenerating(false)
      })

    return () => { cancelled = true }
  }, [id])

  async function refreshPicks() {
    setGenerating(true)
    setTab('picks')
    try {
      const res = await fetch(`/api/matches/${id}/picks`, { method: 'POST' })
      const result = await res.json()
      if (result.picks) {
        setPicks(result.picks)
        setCombos(result.combos ?? [])
        setPicksLoaded(true)
      }
    } finally {
      setGenerating(false)
    }
  }

  if (!data) {
    return (
      <div className="text-center py-20" style={{ color: 'var(--text-dim)' }}>
        <div className="text-4xl mb-3">⚽</div>
        <p>Cargando análisis...</p>
      </div>
    )
  }

  const { match, home, away, alerts } = data
  const highAlerts = alerts.filter((a) => a.confidence === 'HIGH')
  const isLive = match.status === 'live'
  const matchName = `${match.homeTeam} vs ${match.awayTeam}`

  return (
    <div className="space-y-6">
      {/* Header del partido */}
      <div className="rounded-xl p-6" style={{ background: 'var(--surface)', border: isLive ? '1px solid var(--red)' : '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: isLive ? 'var(--red)20' : 'var(--surface2)', color: isLive ? 'var(--red)' : 'var(--text-dim)' }}>
              {isLive ? '🔴 EN VIVO' : match.status === 'finished' ? '✅ FINALIZADO' : '🕐 PRÓXIMO'}
            </span>
            <span className="text-xs ml-2" style={{ color: 'var(--text-dim)' }}>
              Grupo {match.group} · {match.round}
            </span>
          </div>
          <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
            {new Date(match.date).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <div className="flex items-center justify-center gap-6">
          <div className="text-center">
            <div className="text-5xl mb-2">{match.homeFlag}</div>
            <div className="bebas text-2xl">{match.homeTeam}</div>
          </div>
          <div className="text-center">
            {match.result ? (
              <div className="bebas text-5xl" style={{ color: 'var(--green)' }}>{match.result}</div>
            ) : (
              <div className="bebas text-3xl" style={{ color: 'var(--text-dim)' }}>VS</div>
            )}
          </div>
          <div className="text-center">
            <div className="text-5xl mb-2">{match.awayFlag}</div>
            <div className="bebas text-2xl">{match.awayTeam}</div>
          </div>
        </div>

        {/* Resumen rápido de alertas */}
        {highAlerts.length > 0 && (
          <div className="mt-4 p-3 rounded-lg" style={{ background: 'var(--green-glow)', border: '1px solid var(--green)' }}>
            <span className="text-xs font-semibold" style={{ color: 'var(--green)' }}>
              {highAlerts.length} alertas de alta confianza detectadas:
            </span>
            <span className="text-xs ml-2" style={{ color: 'var(--text-dim)' }}>
              {highAlerts.slice(0, 3).map((a) => a.playerName).join(', ')}
              {highAlerts.length > 3 ? ` y ${highAlerts.length - 3} más` : ''}
            </span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl p-1" style={{ background: 'var(--surface)' }}>
        {(['picks', 'lineup', 'alerts'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{ background: tab === t ? 'var(--green)' : 'transparent', color: tab === t ? '#0a0a0f' : 'var(--text-dim)' }}>
            {t === 'picks'  && `Apuestas${picks.length > 0 ? ` (${picks.length})` : ''}`}
            {t === 'lineup' && 'Alineación'}
            {t === 'alerts' && `Alertas${alerts.length > 0 ? ` (${alerts.length})` : ''}`}
          </button>
        ))}
      </div>

      {/* Tab: Picks + Combos */}
      {tab === 'picks' && (
        <div className="space-y-6">
          {!picksLoaded && !generating && (
            <div className="text-center py-12 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="bebas text-3xl mb-3" style={{ color: 'var(--text-dim)' }}>APUESTAS</div>
              <p className="font-semibold mb-1">Modelo estadístico del partido</p>
              <p className="text-sm mb-6" style={{ color: 'var(--text-dim)' }}>
                Apuestas predeterminadas por jugador, ajustadas contra el rival actual y la posible alineación.
              </p>
              <button onClick={refreshPicks}
                className="px-6 py-3 rounded-xl font-bold transition-all hover:scale-105"
                style={{ background: 'var(--green)', color: '#0a0a0f' }}>
                Calcular {match.homeTeam} vs {match.awayTeam}
              </button>
            </div>
          )}

          {generating && (
            <div className="text-center py-12" style={{ color: 'var(--text-dim)' }}>
              <div className="bebas text-2xl mb-3 animate-pulse" style={{ color: 'var(--green)' }}>Calculando...</div>
              <p className="font-semibold">Cruzando actualidad de jugadores contra rival</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>Sin generación creativa: solo mercados definidos y datos disponibles</p>
            </div>
          )}

          {picksLoaded && (
            <>
              {/* Apuestas simples */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="bebas text-xl">Apuestas simples ({picks.length})</h3>
                    <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
                      Mercados base por jugador, ajustados por rival y titularidad.
                    </p>
                  </div>
                  <button onClick={refreshPicks} disabled={generating}
                    className="px-3 py-1.5 rounded text-xs font-semibold"
                    style={{ background: 'var(--surface2)', color: 'var(--text-dim)', border: '1px solid var(--border)' }}>
                    Actualizar
                  </button>
                </div>
                <div className="space-y-2">
                  {picks.map((p, i) => (
                    <SimplePickCard key={i} pick={p} />
                  ))}
                </div>
              </div>

              {/* Combinadas — tickets estilo bet365 */}
              {combos.length > 0 && <ComboSection combos={combos} />}

              {picks.length === 0 && (
                <div className="text-center py-8 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div className="text-3xl mb-2">🔍</div>
                  <p className="font-semibold">Sin picks confiables</p>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>Los promedios actuales no dan una ventaja clara contra este rival.</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Tab: Alineación */}
      {tab === 'lineup' && (
        <div>
          {match.lineupFetchedAt ? (
            <>
              <div className="mb-4 p-3 rounded-lg text-sm flex items-center gap-2" style={{ background: 'var(--green-glow)', border: '1px solid var(--green)', color: 'var(--green)' }}>
                ✅ <strong>Formación oficial confirmada</strong>
                <span style={{ color: 'var(--text-dim)', marginLeft: 'auto' }}>
                  {new Date(match.lineupFetchedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ConfirmedLineup team={match.homeTeam} flag={match.homeFlag} lineup={match.lineupHome ?? []} />
                <ConfirmedLineup team={match.awayTeam} flag={match.awayFlag} lineup={match.lineupAway ?? []} />
              </div>
            </>
          ) : (
            <>
              <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: '#f59e0b15', border: '1px solid #f59e0b44', color: '#f59e0b' }}>
                ⚠️ Alineación <strong>probable</strong> basada en titularidad histórica. Se actualiza automáticamente 30 min antes del KO.
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <TeamColumn team={match.homeTeam} flag={match.homeFlag} players={home} />
                <TeamColumn team={match.awayTeam} flag={match.awayFlag} players={away} />
              </div>
            </>
          )}
        </div>
      )}

      {/* Tab: Alertas estadísticas */}
      {tab === 'alerts' && (
        <div className="space-y-4">
          {alerts.length === 0
            ? <div className="text-center py-12" style={{ color: 'var(--text-dim)' }}>Sin alertas detectadas</div>
            : (['LOW', 'HIGH', 'MEDIUM'] as const).map((conf) => {
                const group = alerts.filter((a) => a.confidence === conf)
                if (!group.length) return null
                const isGem = conf === 'LOW'
                const label = isGem ? 'Oportunidades interesantes' : conf === 'HIGH' ? 'Alta confianza' : 'Media confianza'
                const color = isGem ? '#a78bfa' : confColor[conf]
                return (
                  <div key={conf}>
                    <div className="flex items-center gap-2 mb-2">
                      {isGem && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold"
                          style={{ background: '#a78bfa22', color: '#a78bfa', border: '1px solid #a78bfa44' }}>
                          Cuota alta · stats elevadas para el puesto
                        </div>
                      )}
                      <span className="text-xs font-bold uppercase tracking-widest" style={{ color }}>
                        {label}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-dim)' }}>({group.length})</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {group.map((a, i) => <AlertCard key={i} alert={a} />)}
                    </div>
                  </div>
                )
              })
          }
        </div>
      )}
    </div>
  )
}
