/**
 * Realtime pub/sub transport.
 *
 * Two modes:
 * - memory (default): in-process delivery, single instance only.
 * - redis (REDIS_URL set): cross-instance delivery, required when scaling out.
 *
 * Redis messages are ephemeral: a subscriber that is not connected when a
 * message is published misses it. Widget and admin clients already replay
 * missed state (messages?after=, notifications?since=) so this is safe.
 */

import { createClient, type RedisClientType } from 'redis'

type Subscriber = (payload: any) => void
type ChannelListener = (message: string, channel: string) => void

const CONVERSATION_PREFIX = 'chat:conversation:'
const ADMIN_CHANNEL = 'chat:admin'
const REDIS_RETRY_MS = 30_000

const conversationSubscribers = new Map<string, Set<Subscriber>>()
const adminSubscribers = new Set<Subscriber>()
const channelListeners = new Map<string, ChannelListener>()

let pubClient: RedisClientType | null = null
let subClient: RedisClientType | null = null
let redisEnabled = false
let initPromise: Promise<boolean> | null = null

function channelFor(conversationId: string): string {
  return `${CONVERSATION_PREFIX}${conversationId}`
}

/**
 * Ensures the Redis transport is ready before the HTTP server accepts traffic.
 * Returns true when Redis pub/sub is active; false keeps in-memory delivery.
 */
export function initPubSub(): Promise<boolean> {
  if (!process.env.REDIS_URL) {
    redisEnabled = false
    return Promise.resolve(false)
  }
  if (!initPromise) {
    initPromise = connectRedis().then((ok) => {
      redisEnabled = ok
      if (!ok) {
        initPromise = null
        setTimeout(() => { void initPubSub() }, REDIS_RETRY_MS).unref?.()
      }
      return ok
    })
  }
  return initPromise
}

async function connectRedis(): Promise<boolean> {
  const url = process.env.REDIS_URL!
  const client = createClient({ url })
  client.on('error', (err) => console.error('[pubsub] redis client error:', err.message))

  try {
    await client.connect()
  } catch (err) {
    console.error('[pubsub] redis connect failed, using in-memory transport:', (err as Error).message)
    await client.destroy()
    return false
  }

  const subscriber = client.duplicate()
  subscriber.on('error', (err) => console.error('[pubsub] redis subscriber error:', err.message))
  try {
    await subscriber.connect()
  } catch (err) {
    console.error('[pubsub] redis subscriber connect failed, using in-memory transport:', (err as Error).message)
    await subscriber.destroy()
    await client.destroy()
    return false
  }

  pubClient = client
  subClient = subscriber

  // A channel may have local listeners registered before Redis finished
  // connecting; register those channels so cross-instance delivery works.
  for (const conversationId of conversationSubscribers.keys()) {
    ensureRedisChannel(channelFor(conversationId))
  }
  if (adminSubscribers.size > 0) {
    ensureRedisChannel(ADMIN_CHANNEL)
  }
  return true
}

function getChannelListener(channel: string): ChannelListener {
  let listener = channelListeners.get(channel)
  if (!listener) {
    listener = (message, receivedChannel) => {
      try {
        const payload = JSON.parse(message)
        if (receivedChannel === ADMIN_CHANNEL) {
          dispatchAdmin(payload)
        } else if (receivedChannel.startsWith(CONVERSATION_PREFIX)) {
          dispatch(receivedChannel.slice(CONVERSATION_PREFIX.length), payload)
        }
      } catch (err) {
        console.error('[pubsub] redis message parse failed:', (err as Error).message)
      }
    }
    channelListeners.set(channel, listener)
  }
  return listener
}

function ensureRedisChannel(channel: string): void {
  if (!redisEnabled || !subClient || channelListeners.has(channel)) return
  void subClient.subscribe(channel, getChannelListener(channel))
    .catch((err) => console.error('[pubsub] redis subscribe failed:', err.message))
}

function ensureTransport(): void {
  if (!initPromise && process.env.REDIS_URL) {
    void initPubSub()
  }
}

function dispatch(conversationId: string, payload: any): void {
  const listeners = conversationSubscribers.get(conversationId)
  if (!listeners || listeners.size === 0) return
  for (const fn of listeners) {
    try {
      fn(payload)
    } catch (err) {
      console.error('[pubsub] conversation subscriber error:', (err as Error).message)
    }
  }
}

function dispatchAdmin(payload: any): void {
  if (adminSubscribers.size === 0) return
  for (const fn of adminSubscribers) {
    try {
      fn(payload)
    } catch (err) {
      console.error('[pubsub] admin subscriber error:', (err as Error).message)
    }
  }
}

/** Subscribes this process to realtime updates for one conversation. */
export function subscribe(conversationId: string, fn: Subscriber): () => void {
  ensureTransport()
  let listeners = conversationSubscribers.get(conversationId)
  if (!listeners) {
    listeners = new Set()
    conversationSubscribers.set(conversationId, listeners)
  }
  const isFirst = listeners.size === 0
  listeners.add(fn)

  if (isFirst) {
    ensureRedisChannel(channelFor(conversationId))
  }

  return () => {
    const current = conversationSubscribers.get(conversationId)
    if (!current) return
    current.delete(fn)
    if (current.size === 0) {
      conversationSubscribers.delete(conversationId)
      if (redisEnabled && subClient) {
        const channel = channelFor(conversationId)
        const listener = channelListeners.get(channel)
        void subClient.unsubscribe(channel, listener)
          .catch(() => {})
          .finally(() => { channelListeners.delete(channel) })
      }
    }
  }
}

/** Publishes an update for one conversation to every connected instance. */
export function publish(conversationId: string, payload: any): void {
  if (redisEnabled && pubClient) {
    void pubClient.publish(channelFor(conversationId), JSON.stringify(payload))
      .catch((err) => {
        console.error('[pubsub] redis publish failed, delivering locally:', err.message)
        dispatch(conversationId, payload)
      })
    return
  }
  dispatch(conversationId, payload)
}

/** Subscribes this process to the global admin channel. */
export function subscribeAdmin(fn: Subscriber): () => void {
  ensureTransport()
  const isFirst = adminSubscribers.size === 0
  adminSubscribers.add(fn)
  if (isFirst) {
    ensureRedisChannel(ADMIN_CHANNEL)
  }
  return () => {
    adminSubscribers.delete(fn)
    if (adminSubscribers.size === 0 && redisEnabled && subClient) {
      const listener = channelListeners.get(ADMIN_CHANNEL)
      void subClient.unsubscribe(ADMIN_CHANNEL, listener)
        .catch(() => {})
        .finally(() => { channelListeners.delete(ADMIN_CHANNEL) })
    }
  }
}

/** Publishes an update to every connected admin session. */
export function publishAdmin(payload: any): void {
  if (redisEnabled && pubClient) {
    void pubClient.publish(ADMIN_CHANNEL, JSON.stringify(payload))
      .catch((err) => {
        console.error('[pubsub] redis admin publish failed, delivering locally:', err.message)
        dispatchAdmin(payload)
      })
    return
  }
  dispatchAdmin(payload)
}
