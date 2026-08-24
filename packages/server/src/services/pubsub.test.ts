import assert from 'node:assert/strict'
import test from 'node:test'
import { subscribe, publish, subscribeAdmin, publishAdmin } from './pubsub'

function withoutRedisUrl(fn: () => void): void {
  const previous = process.env.REDIS_URL
  delete process.env.REDIS_URL
  try {
    fn()
  } finally {
    if (previous === undefined) {
      delete process.env.REDIS_URL
    } else {
      process.env.REDIS_URL = previous
    }
  }
}

test('memory mode delivers and cleans up conversation subscribers', () => {
  withoutRedisUrl(() => {
    const received: any[] = []
    const unsubscribe = subscribe('conv-1', (payload) => received.push(payload))
    publish('conv-1', { hello: 'world' })
    assert.deepEqual(received, [{ hello: 'world' }])
    unsubscribe()
    publish('conv-1', { second: true })
    assert.equal(received.length, 1)
  })
})

test('memory mode keeps conversations isolated', () => {
  withoutRedisUrl(() => {
    const a: any[] = []
    const b: any[] = []
    const unsubscribeA = subscribe('conv-a', (payload) => a.push(payload))
    const unsubscribeB = subscribe('conv-b', (payload) => b.push(payload))
    publish('conv-a', { x: 1 })
    assert.equal(a.length, 1)
    assert.equal(b.length, 0)
    unsubscribeA()
    unsubscribeB()
  })
})

test('memory mode delivers and cleans up admin subscribers', () => {
  withoutRedisUrl(() => {
    const received: any[] = []
    const unsubscribe = subscribeAdmin((payload) => received.push(payload))
    publishAdmin({ event: 'user_message' })
    assert.equal(received.length, 1)
    unsubscribe()
    publishAdmin({ event: 'again' })
    assert.equal(received.length, 1)
  })
})

test('memory mode survives a throwing subscriber', () => {
  withoutRedisUrl(() => {
    const received: any[] = []
    const unsubscribe = subscribe('conv-throw', () => {
      throw new Error('boom')
    })
    const healthy = subscribe('conv-throw', (payload) => received.push(payload))
    publish('conv-throw', { ok: true })
    assert.deepEqual(received, [{ ok: true }])
    unsubscribe()
    healthy()
  })
})
