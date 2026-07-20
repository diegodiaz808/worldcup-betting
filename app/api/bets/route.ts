import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const bets = await prisma.betTracker.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json(bets)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const bet = await prisma.betTracker.create({
    data: {
      comboId:     body.comboId     ?? null,
      matchId:     body.matchId     ?? null,
      matchName:   body.matchName   ?? '',
      player:      body.player,
      marketId:    body.marketId,
      marketLabel: body.marketLabel,
      line:        body.line,
      odds:        Number(body.odds),
      stake:       Number(body.stake ?? 1),
      notes:       body.notes       ?? '',
    },
  })
  return NextResponse.json(bet)
}
