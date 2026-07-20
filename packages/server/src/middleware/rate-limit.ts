import { createHash, randomUUID } from 'node:crypto'
import Redis from 'ioredis'
import { Request, RequestHandler } from 'express'

export interface RateLimitOptions {
  name: string
  windowMs: number
  max: number
  keyGenerator?: (req: Request) => string
}

export interface RateLimitDecision {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

export interface RateLimitStore {
  consume(key: string): Promise<RateLimitDecision>
}

interface RedisRateLimitClient {
  eval(script: string, numberOfKeys: number, ...args: string[]): Promise<unknown>
  set(key: string, value: string, mode: 'PX', duration: number, condition: 'NX'): Promise<unknown>
}

const CONSUME_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return { current, redis.call('PTTL', KEYS[1]) }
`
const RELEASE_CONNECTION_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`
const REFRESH_CONNECTION_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('PEXPIRE', KEYS[1], ARGV[2])
end
return 0
`

function hashKey(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export class RedisRateLimitStore implements RateLimitStore {
  constructor(
    private readonly client: RedisRateLimitClient,
    private readonly namespace: string,
    private readonly windowMs: number,
    private readonly max: number,
  ) {}

  async consume(key: string): Promise<RateLimitDecision> {
    const redisKey = this.namespace + ':' + hashKey(key)
    const result = await this.client.eval(CONSUME_SCRIPT, 1, redisKey, String(this.windowMs))
    const values = Array.isArray(result) ? result : [result, this.windowMs]
    const count = Number(values[0])
    const ttlMs = Math.max(1_000, Number(values[1]))
    return {
      allowed: count <= this.max,
      remaining: Math.max(0, this.max - count),
      retryAfterSeconds: Math.max(1, Math.ceil(ttlMs / 1_000)),
    }
  }
}

export class RedisConnectionStore {
  constructor(
    private readonly client: RedisRateLimitClient,
    private readonly namespace = 'chatbot:connections',
    private readonly leaseMs = 120_000,
  ) {}

  async acquire(key: string, max: number): Promise<string | null> {
    const baseKey = this.namespace + ':' + hashKey(key)
    const token = randomUUID()
    for (let slot = 0; slot < max; slot += 1) {
      const result = await this.client.set(baseKey + ':' + slot, token, 'PX', this.leaseMs, 'NX')
      if (result === 'OK') return token + ':' + slot
    }
    return null
  }

  async release(key: string, connectionToken: string): Promise<void> {
    const separator = connectionToken.lastIndexOf(':')
    if (separator < 1) return
    const token = connectionToken.slice(0, separator)
    const slot = connectionToken.slice(separator + 1)
    const redisKey = this.namespace + ':' + hashKey(key) + ':' + slot
    await this.client.eval(RELEASE_CONNECTION_SCRIPT, 1, redisKey, token)
  }

  async refresh(key: string, connectionToken: string): Promise<void> {
    const separator = connectionToken.lastIndexOf(':')
    if (separator < 1) return
    const token = connectionToken.slice(0, separator)
    const slot = connectionToken.slice(separator + 1)
    const redisKey = this.namespace + ':' + hashKey(key) + ':' + slot
    await this.client.eval(REFRESH_CONNECTION_SCRIPT, 1, redisKey, token, String(this.leaseMs))
  }
}

let sharedRedisClient: RedisRateLimitClient | null = null
const rateLimitStores = new Map<string, RedisRateLimitStore>()
let connectionStore: RedisConnectionStore | null = null

export function assertRedisConfigured(): void {
  if (!process.env.REDIS_URL?.trim()) {
    throw new Error('REDIS_URL must be configured for rate limiting')
  }
}

function getRedisClient(): RedisRateLimitClient {
  if (sharedRedisClient) return sharedRedisClient
  assertRedisConfigured()
  const client = new Redis(process.env.REDIS_URL as string, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
  })
  client.on('error', (error) => {
    console.error('[rate-limit] Redis error:', error.message)
  })
  sharedRedisClient = {
    eval: (script, numberOfKeys, ...args) => client.eval(script, numberOfKeys, ...args),
    set: (key, value, mode, duration, condition) => client.set(key, value, mode, duration, condition),
  }
  return sharedRedisClient
}

function getRateLimitStore(options: RateLimitOptions): RedisRateLimitStore {
  const storeKey = options.name + ':' + options.windowMs + ':' + options.max
  const existing = rateLimitStores.get(storeKey)
  if (existing) return existing
  const store = new RedisRateLimitStore(getRedisClient(), 'chatbot:rate-limit:' + options.name, options.windowMs, options.max)
  rateLimitStores.set(storeKey, store)
  return store
}

function getConnectionStore(): RedisConnectionStore {
  if (!connectionStore) connectionStore = new RedisConnectionStore(getRedisClient())
  return connectionStore
}

export function createRateLimiter(options: RateLimitOptions, store?: RateLimitStore): RequestHandler {
  const keyGenerator = options.keyGenerator || ((req: Request) => req.ip || 'unknown')

  return async (req, res, next) => {
    try {
      const decision = await (store || getRateLimitStore(options)).consume(keyGenerator(req))
      if (!decision.allowed) {
        res.setHeader('Retry-After', String(decision.retryAfterSeconds))
        res.status(429).json({ code: 1, message: '请求过于频繁，请稍后再试' })
        return
      }
      res.setHeader('X-RateLimit-Remaining', String(decision.remaining))
      next()
    } catch (error) {
      console.error('[rate-limit] Redis unavailable:', error instanceof Error ? error.message : error)
      res.status(503).json({ code: 1, message: '服务暂时不可用，请稍后再试' })
    }
  }
}

export async function tryAcquireConnection(key: string, max: number): Promise<string | null> {
  return getConnectionStore().acquire(key, max)
}

export async function releaseConnection(key: string, connectionToken: string): Promise<void> {
  await getConnectionStore().release(key, connectionToken)
}

export async function refreshConnection(key: string, connectionToken: string): Promise<void> {
  await getConnectionStore().refresh(key, connectionToken)
}

export const chatRateLimiters = {
  session: createRateLimiter({ name: 'session', windowMs: 60_000, max: 10 }),
  message: createRateLimiter({
    name: 'message',
    windowMs: 60_000,
    max: 30,
    keyGenerator: (req) => (req.ip || 'unknown') + ':' + String(req.body?.conversationId || ''),
  }),
  lead: createRateLimiter({
    name: 'lead',
    windowMs: 60_000,
    max: 5,
    keyGenerator: (req) => (req.ip || 'unknown') + ':' + String(req.body?.conversationId || ''),
  }),
  stream: createRateLimiter({
    name: 'stream',
    windowMs: 60_000,
    max: 10,
    keyGenerator: (req) => (req.ip || 'unknown') + ':' + String(req.query?.conversationId || ''),
  }),
}

export const adminLoginRateLimiter = createRateLimiter({
  name: 'admin-login',
  windowMs: 60_000,
  max: 5,
})