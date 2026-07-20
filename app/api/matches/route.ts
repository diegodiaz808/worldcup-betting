import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { seedPlayersIfEmpty } from '@/lib/sync'

export async function GET() {
  await seedPlayersIfEmpty()

  const matches = await prisma.match.findMany({
    orderBy: { date: 'asc' },
  })

  return NextResponse.json(matches)
}
