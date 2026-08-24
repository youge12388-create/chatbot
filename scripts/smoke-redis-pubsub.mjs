/**
 * Cross-instance Redis pub/sub smoke test.
 *
 * Starts two independent Node processes that each load the real pubsub
 * transport, then verifies a message published by one process is delivered
 * to the other through Redis.
 *
 * Usage:
 *   node scripts/smoke-redis-pubsub.mjs
 *
 * Set REDIS_URL to reuse an external Redis; otherwise this script starts a
 * temporary in-memory Redis via redis-memory-server (Windows: Memurai).
 */

import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pubsubPath = path.join(projectRoot, 'packages', 'server', 'dist', 'services', 'pubsub.js')

let redis
let redisUrl = process.env.REDIS_URL
if (!redisUrl) {
  const { RedisMemoryServer } = await import('file:///C:/tmp/smoke-redis/node_modules/redis-memory-server/lib/index.js')
  redis = await RedisMemoryServer.create()
  redisUrl = `redis://${await redis.getHost()}:${await redis.getPort()}`
}

console.log(`[smoke] redis: ${redisUrl}`)
console.log(`[smoke] pubsub module: ${pubsubPath}`)

const smokeId = `smoke-${Date.now()}`
const channel = `conv-${smokeId}`
const env = { ...process.env, REDIS_URL: redisUrl }

const subscriberCode = `
const { initPubSub, subscribe, subscribeAdmin } = require(${JSON.stringify(pubsubPath)})
;(async () => {
  const ok = await initPubSub()
  if (!ok) { console.error('subscriber: redis not enabled'); process.exit(2) }
  subscribe(${JSON.stringify(channel)}, (payload) => {
    console.log('RECEIVED_CONV ' + JSON.stringify(payload))
    setTimeout(() => process.exit(0), 200)
  })
  subscribeAdmin((payload) => console.log('RECEIVED_ADMIN ' + JSON.stringify(payload)))
  await new Promise((resolve) => setTimeout(resolve, 400))
  console.log('SUBSCRIBER_READY')
})().catch((err) => { console.error('subscriber error:', err); process.exit(1) })
`

const publisherCode = `
const { initPubSub, publish, publishAdmin } = require(${JSON.stringify(pubsubPath)})
;(async () => {
  const ok = await initPubSub()
  if (!ok) { console.error('publisher: redis not enabled'); process.exit(2) }
  await new Promise((resolve) => setTimeout(resolve, 200))
  publishAdmin({ event: 'smoke', channel: ${JSON.stringify(channel)} })
  await new Promise((resolve) => setTimeout(resolve, 100))
  publish(${JSON.stringify(channel)}, { hello: 'world', ts: Date.now() })
  await new Promise((resolve) => setTimeout(resolve, 300))
  console.log('PUBLISHER_DONE')
  process.exit(0)
})().catch((err) => { console.error('publisher error:', err); process.exit(1) })
`

function spawnNode(code) {
  const child = spawn(process.execPath, ['-e', code], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout.on('data', (chunk) => process.stdout.write(`  [child] ${chunk}`))
  child.stderr.on('data', (chunk) => process.stderr.write(`  [child] ${chunk}`))
  return child
}

function waitForExit(child, timeoutMs) {
  return new Promise((resolve) => {
    if (child.exitCode !== null) {
      resolve({ code: child.exitCode, timedOut: false })
      return
    }
    const timer = setTimeout(() => {
      child.kill()
      resolve({ timedOut: true })
    }, timeoutMs)
    child.on('exit', (code) => {
      clearTimeout(timer)
      resolve({ code, timedOut: false })
    })
  })
}

let failed = false
try {
  const subscriber = spawnNode(subscriberCode)
  let subscriberOut = ''
  subscriber.stdout.on('data', (chunk) => { subscriberOut += chunk.toString() })

  const readyStart = Date.now()
  while (!subscriberOut.includes('SUBSCRIBER_READY')) {
    if (Date.now() - readyStart > 20_000) {
      throw new Error('timed out waiting for subscriber to become ready')
    }
    await delay(100)
  }

  await delay(250)

  const publisher = spawnNode(publisherCode)
  const publisherExit = await waitForExit(publisher, 15_000)
  if (publisherExit.timedOut || publisherExit.code !== 0) {
    throw new Error(`publisher did not finish cleanly: ${JSON.stringify(publisherExit)}`)
  }

  const subscriberExit = await waitForExit(subscriber, 15_000)
  if (subscriberExit.timedOut) {
    throw new Error('subscriber did not receive the conversation message')
  }

  const convReceived = subscriberOut.includes('RECEIVED_CONV')
  const adminReceived = subscriberOut.includes('RECEIVED_ADMIN')
  console.log(`[smoke] conversation message received: ${convReceived}`)
  console.log(`[smoke] admin message received: ${adminReceived}`)

  if (!convReceived || !adminReceived) {
    throw new Error('one or more messages were not delivered across processes')
  }
} catch (err) {
  failed = true
  console.error(`[smoke] FAIL: ${err.message}`)
} finally {
  if (redis) {
    await redis.stop()
  }
}

if (failed) {
  process.exit(1)
}
console.log('[smoke] PASS: cross-instance pub/sub works')
