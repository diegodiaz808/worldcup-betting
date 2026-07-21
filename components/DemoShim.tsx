'use client'

// Demo mode: the live data APIs behind this app are gone, so the static demo
// serves the last real snapshot (public/data/*) captured before shutdown.
// Patching fetch at module scope guarantees it runs before any page effect.

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || ''

function demoUrl(path: string, query: URLSearchParams): string | null {
  if (path === '/api/matches') return `${BASE}/data/matches.json`
  if (path.startsWith('/api/matches/')) {
    const id = path.split('/')[3]
    return id ? `${BASE}/data/matches/${id}.json` : null
  }
  if (path === '/api/system') return `${BASE}/data/system.json`
  if (path === '/api/bets') return `${BASE}/data/bets.json`
  if (path === '/api/combos') return `${BASE}/data/combos.json`
  if (path === '/api/players') return `${BASE}/data/players.json`
  if (path === '/api/worldcup/insights') {
    return query.get('view') === 'players'
      ? `${BASE}/data/insights-players.json`
      : `${BASE}/data/insights-limit5.json`
  }
  return null
}

if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_DEMO === '1') {
  const realFetch = window.fetch.bind(window)
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (raw.includes('/api/')) {
      const u = new URL(raw, window.location.origin)
      const method = (init?.method || 'GET').toUpperCase()
      if (method !== 'GET') {
        return Promise.resolve(
          new Response(JSON.stringify({ demo: true, message: 'Demo estático: acción deshabilitada' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }
      const mapped = demoUrl(u.pathname.replace(BASE, ''), u.searchParams)
      // revalidate snapshot files so a rebuilt demo isn't masked by HTTP cache
      if (mapped) return realFetch(mapped, { cache: 'no-cache' })
    }
    return realFetch(input as RequestInfo, init)
  }
}

export default function DemoShim() {
  if (process.env.NEXT_PUBLIC_DEMO !== '1') return null
  return (
    <div
      style={{
        background: '#b8860b',
        color: '#fff',
        textAlign: 'center',
        padding: '6px 12px',
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      DEMO - snapshot real y estático de la última corrida del sistema (las APIs de datos en vivo ya no operan)
    </div>
  )
}
