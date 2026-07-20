import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const player = await prisma.player.findUnique({
    where: { id: params.id },
    include: { stats: true, wcStats: true },
  })

  if (!player) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 })
  }

  const recentMatches = await prisma.match.findMany({
    orderBy: { date: 'desc' },
    take: 5,
  })

  return NextResponse.json({ ...player, recentMatches })
}
