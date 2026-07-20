import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Guardar suscripción
export async function POST(req: NextRequest) {
  const { subscription, label } = await req.json()
  if (!subscription?.endpoint) return NextResponse.json({ error: 'Invalid' }, { status: 400 })

  await prisma.pushSubscription.upsert({
    where:  { endpoint: subscription.endpoint },
    update: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, label: label ?? '' },
    create: { endpoint: subscription.endpoint, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, label: label ?? '' },
  })
  return NextResponse.json({ ok: true })
}

// Borrar suscripción
export async function DELETE(req: NextRequest) {
  const { endpoint } = await req.json()
  await prisma.pushSubscription.deleteMany({ where: { endpoint } }).catch(() => {})
  return NextResponse.json({ ok: true })
}
