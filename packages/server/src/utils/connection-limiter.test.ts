import assert from 'node:assert/strict'
import test from 'node:test'
import { createConnectionLimiter } from './connection-limiter'

test('acquires slots up to the configured limit', () => {
  const limiter = createConnectionLimiter(2)
  assert.equal(limiter.tryAcquire(), true)
  assert.equal(limiter.tryAcquire(), true)
  assert.equal(limiter.tryAcquire(), false)
  assert.equal(limiter.activeCount(), 2)
})

test('releasing a slot allows the next acquisition', () => {
  const limiter = createConnectionLimiter(1)
  assert.equal(limiter.tryAcquire(), true)
  limiter.release()
  assert.equal(limiter.tryAcquire(), true)
})

test('release never drops below zero', () => {
  const limiter = createConnectionLimiter(1)
  limiter.release()
  limiter.release()
  assert.equal(limiter.activeCount(), 0)
})
