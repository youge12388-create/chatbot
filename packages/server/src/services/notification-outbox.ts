import { randomUUID } from 'node:crypto'
import { prisma } from '../db/client'
import { leadService } from './lead'

const WORKER_ID = 'notification-worker:' + randomUUID()
const POLL_INTERVAL_MS = 5_000
const LEASE_MS = 60_000
const MAX_ATTEMPTS = 5
const BATCH_SIZE = 20
const RETRY_DELAYS_MS = [60_000, 300_000, 1_800_000, 7_200_000, 43_200_000]

export function getNotificationRetryDelay(attempt: number): number {
  return RETRY_DELAYS_MS[Math.min(Math.max(attempt - 1, 0), RETRY_DELAYS_MS.length - 1)]
}
async function deliver(job: {
  eventType: string
  conversationId: string | null
}): Promise<boolean> {
  if (!job.conversationId) return false
  if (job.eventType === 'new_lead') {
    return leadService.notifyNewLead(job.conversationId)
  }
  if (job.eventType === 'transfer_request') {
    return leadService.notifyTransfer(job.conversationId)
  }
  return false
}

export async function processNotificationOutbox(now = new Date()): Promise<number> {
  const expiredLeaseAt = new Date(now.getTime() - LEASE_MS)
  const jobs = await prisma.notificationOutbox.findMany({
    where: {
      status: 'pending',
      availableAt: { lte: now },
      OR: [
        { lockedAt: null },
        { lockedAt: { lt: expiredLeaseAt } },
      ],
    },
    orderBy: { createdAt: 'asc' },
    take: BATCH_SIZE,
  })

  let processed = 0
  for (const job of jobs) {
    const claim = await prisma.notificationOutbox.updateMany({
      where: {
        id: job.id,
        status: 'pending',
        OR: [
          { lockedAt: null },
          { lockedAt: { lt: expiredLeaseAt } },
        ],
      },
      data: {
        lockedAt: now,
        lockedBy: WORKER_ID,
      },
    })
    if (claim.count !== 1) continue

    const attempts = job.attempts + 1
    let success = false
    let errorMessage = ''
    try {
      success = await deliver(job)
      if (!success) errorMessage = 'Webhook delivery failed'
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Webhook delivery failed'
    }

    if (success) {
      await prisma.notificationOutbox.update({
        where: { id: job.id },
        data: {
          status: 'sent',
          attempts,
          sentAt: now,
          lockedAt: null,
          lockedBy: null,
          lastError: null,
        },
      })
    } else {
      const exhausted = attempts >= MAX_ATTEMPTS
      const delay = getNotificationRetryDelay(attempts)
      await prisma.notificationOutbox.update({
        where: { id: job.id },
        data: {
          status: exhausted ? 'failed' : 'pending',
          attempts,
          availableAt: new Date(now.getTime() + delay),
          lockedAt: null,
          lockedBy: null,
          lastError: errorMessage || 'Webhook delivery failed',
        },
      })
    }
    processed += 1
  }

  return processed
}

export function startNotificationOutboxWorker(): () => void {
  let running = false
  const tick = async () => {
    if (running) return
    running = true
    try {
      await processNotificationOutbox()
    } catch (error) {
      console.error('[notification-outbox] worker error:', error instanceof Error ? error.message : error)
    } finally {
      running = false
    }
  }

  void tick()
  const timer = setInterval(() => { void tick() }, POLL_INTERVAL_MS)
  return () => clearInterval(timer)
}