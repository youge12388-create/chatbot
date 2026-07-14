import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeSiteDomain } from './site-domain'

test('normalizes a website domain', () => {
  assert.equal(normalizeSiteDomain(' HTTPS://LuckyBoy.ME/ '), 'luckyboy.me')
})

test('allows localhost with a port for local development', () => {
  assert.equal(normalizeSiteDomain('localhost:5173'), 'localhost:5173')
})

test('rejects generated site identifiers and URL paths', () => {
  assert.equal(normalizeSiteDomain('cmrgdlbi300008hsqmynz2lu9'), null)
  assert.equal(normalizeSiteDomain('https://luckyboy.me/admin'), null)
})
