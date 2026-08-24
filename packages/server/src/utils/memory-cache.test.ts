import assert from 'node:assert/strict'
import test from 'node:test'
import { createTtlCache } from './memory-cache'

test('stores and returns values before expiry', () => {
  const cache = createTtlCache<string>(1000)
  cache.set('a', '1')
  assert.equal(cache.get('a'), '1')
  assert.equal(cache.size(), 1)
})

test('expires values after the ttl', async () => {
  const cache = createTtlCache<string>(30)
  cache.set('a', '1')
  await new Promise((resolve) => setTimeout(resolve, 40))
  assert.equal(cache.get('a'), undefined)
})

test('delete and clear remove entries', () => {
  const cache = createTtlCache<string>(1000)
  cache.set('a', '1')
  cache.set('b', '2')
  cache.delete('a')
  assert.equal(cache.get('a'), undefined)
  cache.clear()
  assert.equal(cache.size(), 0)
})

test('evicts oldest when full', () => {
  const cache = createTtlCache<string>(1000, 2)
  cache.set('a', '1')
  cache.set('b', '2')
  cache.set('c', '3')
  assert.equal(cache.get('a'), undefined)
  assert.equal(cache.get('b'), '2')
  assert.equal(cache.get('c'), '3')
})
