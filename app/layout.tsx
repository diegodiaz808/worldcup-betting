import type { Metadata } from 'next'
import { Bebas_Neue, Inter } from 'next/font/google'
import './globals.css'
import NavBar from '@/components/NavBar'
import DemoShim from '@/components/DemoShim'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const bebasNeue = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bebas',
})

export const metadata: Metadata = {
  title: 'CojeCasinos',
  description: 'Inteligencia estadística para apuestas deportivas - Mundial 2026',
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⚽</text></svg>",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} ${bebasNeue.variable}`}>
      <body className="antialiased min-h-screen font-sans" style={{ background: 'var(--bg)' }}>
        <DemoShim />
        <NavBar />
        <main className="max-w-5xl mx-auto px-4 py-6 pb-20">{children}</main>
      </body>
    </html>
  )
}
