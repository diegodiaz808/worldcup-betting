import { NextRequest, NextResponse } from 'next/server'
import { getWorldCupInsights, getWorldCupPlayerBoards } from '@/lib/worldcup-insights'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const limit = Number(searchParams.get('limit') ?? 5)
  const view = searchParams.get('view') ?? 'home'

  const cappedLimit = Math.min(Math.max(limit || 5, 1), 25)
  const data = view === 'players'
    ? await getWorldCupPlayerBoards(cappedLimit)
    : await getWorldCupInsights(cappedLimit)

  return NextResponse.json(data)
}
