import { NextRequest, NextResponse } from 'next/server'
import { refreshMatchPicks } from '@/lib/cron'

// POST /api/sync/picks?matchId=xxx  - regenera picks de un partido
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const matchId = searchParams.get('matchId')
  if (!matchId) return NextResponse.json({ error: 'Falta ?matchId=' }, { status: 400 })

  const result = await refreshMatchPicks(matchId)
  return NextResponse.json(result)
}
