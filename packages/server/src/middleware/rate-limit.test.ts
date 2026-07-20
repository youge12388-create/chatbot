import assert from 'node:assert/strict'
import test from 'node:test'
import { RedisConnectionStore, RedisRateLimitStore } from './rate-limit'

class FakeRedis {
  private readonly values = new Map<string, string>()
  private readonly counts = new Map<string, number>()

  async eval(script: string, _numberOfKeys: number, ...args: string[]): Promise<unknown> {
    if (script.includes("redis.call('INCR'")) {
      const key = args[0]
      const count = (this.counts.get(key) || 0) + 1
      this.counts.set(key, count)
      return [count, 1_000]
    }
    const key = args[0]
    const token = args[1]
    if (this.values.get(key) !== token) return 0
    if (script.includes("redis.call('DEL'")) {
      this.values.delete(key)
      return 1
    }
    return 1
  }

  async set(key: string, value: string, _mode: 'PX', _duration: number, _condition: 'NX'): Promise<unknown> {
    if (this.values.has(key)) return null
    this.values.set(key, value)
    return 'OK'
  }
}

test('Redis 限流存储按窗口拒绝超额请求', async () => {
  const store = new RedisRateLimitStore(new FakeRedis(), 'test', 1_000, 2)

  assert.equal((await store.consume('client')).allowed, true)
  assert.equal((await store.consume('client')).allowed, true)
  assert.equal((await store.consume('client')).allowed, false)
})

test('Redis SSE 连接槽位支持释放且不能被伪造令牌释放', async () => {
  const redis = new FakeRedis()
  const store = new RedisConnectionStore(redis, 'test-connections', 1_000)
  const first = await store.acquire('client', 2)
  const second = await store.acquire('client', 2)
  assert.ok(first)
  assert.ok(second)
  assert.equal(await store.acquire('client', 2), null)

  await store.release('client', 'forged:0')
  assert.equal(await store.acquire('client', 2), null)

  await store.release('client', first)
  assert.ok(await store.acquire('client', 2))
})