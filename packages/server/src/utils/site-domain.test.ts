import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeSiteDomain, normalizeSiteOrigin } from './site-domain'

test('normalizes a website domain', () => {
  assert.equal(normalizeSiteDomain(' HTTPS://Example.COM/ '), 'example.com')
})

test('allows localhost with a port for local development', () => {
  assert.equal(normalizeSiteDomain('localhost:5173'), 'localhost:5173')
})

test('rejects generated site identifiers and URL paths', () => {
  assert.equal(normalizeSiteDomain('cmrgdlbi300008hsqmynz2lu9'), null)
  assert.equal(normalizeSiteDomain('https://example.com/admin'), null)
})

test('normalizes a browser origin to the configured site host', () => {
  assert.equal(normalizeSiteOrigin('https://Check.Example.COM'), 'check.example.com')
  assert.equal(normalizeSiteOrigin('https://192.0.2.10'), '192.0.2.10')
})

test('rejects origins with a path or unsupported protocol', () => {
  assert.equal(normalizeSiteOrigin('https://example.com/path'), null)
  assert.equal(normalizeSiteOrigin('javascript://example.com'), null)
})
