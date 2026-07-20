import { NextRequest, NextResponse } from 'next/server'
import { syncOneCountry } from '@/lib/sync'
import { prisma } from '@/lib/prisma'

// GET: cuántos países tienen jugadores
export async function GET() {
  const counts = await prisma.player.groupBy({
    by: ['country'],
    _count: { id: true },
    orderBy: { country: 'asc' },
  })
  return NextResponse.json({
    countries: counts.map((c) => ({ country: c.country, players: (c._count as { id: number }).id })),
  })
}

// POST ?country=Mexico  - sincroniza un solo país (~2 min, no genera timeout HTTP)
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const country = searchParams.get('country')
  if (!country) return NextResponse.json({ error: 'Falta ?country=' }, { status: 400 })

  const result = await syncOneCountry(country)
  return NextResponse.json(result)
}
