'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/',        label: 'Hoy' },
  { href: '/matches', label: 'Partidos' },
  { href: '/players', label: 'Jugadores' },
  { href: '/system',  label: 'Sistema' },
]

export default function NavBar() {
  const path = usePathname()

  return (
    <nav
      style={{
        background: 'var(--surface)',
        borderBottom: '2px solid var(--green)',
      }}
      className="sticky top-0 z-50"
    >
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <span className="bebas text-2xl tracking-wider" style={{ color: 'var(--green)' }}>
            CojeCasinos
          </span>
          <span
            className="hidden sm:block text-xs uppercase tracking-widest font-semibold"
            style={{ color: 'var(--text-dim)' }}
          >
            WC 2026
          </span>
        </Link>

        <div className="flex items-center gap-1">
          {NAV.map(({ href, label }) => {
            const active = path === href
            return (
              <Link
                key={href}
                href={href}
                className="px-3 py-1.5 rounded text-sm font-semibold transition-colors"
                style={{
                  background: active ? 'var(--green)' : 'transparent',
                  color: active ? '#000' : 'var(--text-dim)',
                }}
              >
                {label}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
