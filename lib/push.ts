import { prisma } from './prisma'

export async function sendPushToAll(title: string, body: string, url?: string) {
  // Dynamic import avoids webpack trying to bundle web-push (uses Node crypto)
  const webpush = (await import('web-push')).default

  webpush.setVapidDetails(
    'https://localhost/cojecasinos',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '',
    process.env.VAPID_PRIVATE_KEY ?? '',
  )

  const subs = await prisma.pushSubscription.findMany()
  const dead: string[] = []

  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title, body, url: url ?? '/' }),
        )
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) dead.push(s.id)
      }
    })
  )

  if (dead.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: dead } } })
  }
}
