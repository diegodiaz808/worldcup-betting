import { NextRequest, NextResponse } from 'next/server'
import { runFullSync } from '@/lib/sync'

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const force = searchParams.get('force') === 'true'
  const result = await runFullSync(force)
  return NextResponse.json(result)
}

export async function GET() {
  const { prisma } = await import('@/lib/prisma')
  const lastLog = await prisma.syncLog.findFirst({
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(lastLog)
}
