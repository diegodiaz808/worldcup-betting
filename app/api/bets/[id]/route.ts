import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { updateMarketAccuracy, updateDailyStats } from '@/lib/track'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const result: 'won' | 'lost' | 'void' = body.result

  const bet = await prisma.betTracker.findUnique({ where: { id: params.id } })
  if (!bet) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const profit = result === 'won' ? (bet.stake * bet.odds) - bet.stake
               : result === 'void' ? 0
               : -bet.stake

  const updated = await prisma.betTracker.update({
    where: { id: params.id },
    data:  { result, profit, settledAt: new Date(), notes: body.notes ?? bet.notes },
  })

  await updateMarketAccuracy()
  await updateDailyStats()

  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.betTracker.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
