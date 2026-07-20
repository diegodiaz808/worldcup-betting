import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { seedPlayersIfEmpty } from '@/lib/sync'

export async function GET(req: NextRequest) {
  await seedPlayersIfEmpty()

  const { searchParams } = new URL(req.url)
  const position = searchParams.get('position')
  const sort = searchParams.get('sort') ?? 'score'

  const players = await prisma.player.findMany({
    where: position ? { position } : undefined,
    include: { stats: true, wcStats: true },
  })

  const scored = players.map((player) => {
    const s2m = player.stats.find((s) => s.period === '2m')
    const s6m = player.stats.find((s) => s.period === '6m')
    const weightedScore = s2m?.weightedScore ?? 0
    return { ...player, weightedScore, stats2m: s2m, stats6m: s6m }
  })

  scored.sort((a, b) => {
    if (sort === 'goals') {
      return (b.stats2m?.goals ?? 0) - (a.stats2m?.goals ?? 0)
    }
    if (sort === 'rating') {
      return (b.stats2m?.rating ?? 0) - (a.stats2m?.rating ?? 0)
    }
    return b.weightedScore - a.weightedScore
  })

  return NextResponse.json(scored)
}
