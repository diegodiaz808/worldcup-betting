import fs from 'fs'
import path from 'path'

// Static export needs every match id at build time; the demo snapshot is the
// source of truth. In normal dev/build this list is simply unused overhead.
export function generateStaticParams() {
  try {
    const file = path.join(process.cwd(), 'public', 'data', 'matches.json')
    const matches = JSON.parse(fs.readFileSync(file, 'utf8')) as { id: string }[]
    return matches.map((m) => ({ id: m.id }))
  } catch {
    return []
  }
}

export default function MatchLayout({ children }: { children: React.ReactNode }) {
  return children
}
