import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const combos = await prisma.combo.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  const parsed = combos.map((c) => ({
    ...c,
    picks: JSON.parse(c.picks),
  }))

  return NextResponse.json(parsed)
}
