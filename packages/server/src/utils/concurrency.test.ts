import assert from 'node:assert/strict'
import test from 'node:test'
import { createLimiter } from './concurrency'

test('runs at most maxConcurrent tasks at once', async () => {
  const limiter = createLimiter(2)
  let running = 0
  let peak = 0
  const n = 6
  const jobs = Array.from({ length: n }, () => limiter.run(async () => {
    running += 1
    peak = Math.max(peak, running)
    await new Promise((resolve) => setTimeout(resolve, 20))
    running -= 1
  }))
  await Promise.all(jobs)
  assert.equal(peak, 2)
})

test('queues tasks when the limit is reached', async () => {
  const limiter = createLimiter(1)
  const results: number[] = []
  const jobs = [1, 2, 3].map((value) => limiter.run(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10))
    results.push(value)
  }))
  await Promise.all(jobs)
  assert.deepEqual(results, [1, 2, 3])
})

test('rejects when the queue is full', async () => {
  const limiter = createLimiter(1, 1)
  const blocking = limiter.run(() => new Promise((resolve) => setTimeout(resolve, 30)))
  await new Promise((resolve) => setTimeout(resolve, 5))
  const queued = limiter.run(() => Promise.resolve(1))
  await assert.rejects(() => limiter.run(() => Promise.resolve(2)), /queue full/)
  await queued
  await blocking
})
