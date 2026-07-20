import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const [accuracy, daily, totals, totalSuggestions, pendingSuggestions] = await Promise.all([
    prisma.marketAccuracy.findMany({ orderBy: { total: 'desc' } }),
    prisma.dailySystemStats.findMany({ orderBy: { date: 'desc' }, take: 14 }),
    prisma.systemPick.aggregate({
      _count: { id: true },
      _sum:   { stake: true, profit: true },
      where:  { result: { in: ['won', 'lost'] } },
    }),
    prisma.systemPick.count(),
    prisma.systemPick.count({ where: { result: 'pending' } }),
  ])

  const totalStake  = totals._sum.stake  ?? 0
  const totalProfit = totals._sum.profit ?? 0
  const totalBets   = totals._count.id   ?? 0
  const wonBets     = await prisma.systemPick.count({ where: { result: 'won' } })
  const hasEvaluatedSuggestions = totalBets > 0

  return NextResponse.json({
    accuracy: hasEvaluatedSuggestions ? accuracy : [],
    daily: hasEvaluatedSuggestions ? daily : [],
    summary: {
      totalBets,
      wonBets,
      hitRate: totalBets > 0 ? wonBets / totalBets : 0,
      totalStake,
      totalProfit,
      totalSuggestions,
      pendingSuggestions,
      roi: totalStake > 0 ? totalProfit / totalStake : 0,
    },
  })
}
