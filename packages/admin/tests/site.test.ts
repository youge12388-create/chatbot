import assert from 'node:assert/strict'
import test from 'node:test'
import { hasSiteUrl, siteDisplayUrl, siteHref, siteUrlInfo } from '../src/utils/site'

test('site ID is shown as an unconfigured URL', () => {
  assert.deepEqual(siteUrlInfo('cmrgdlbi300008hsqmynz2lu9', 'cmrgdlbi300008hsqmynz2lu9'), {
    configured: false,
    display: '未配置网址',
    href: null,
  })
})

test('a bare generated identifier is not treated as a website', () => {
  assert.equal(siteUrlInfo('cmrexwgio0000by7f3izi80v5').configured, false)
})

test('a real domain gets a safe HTTPS link', () => {
  assert.deepEqual(siteUrlInfo('luckyboy.me'), {
    configured: true,
    display: 'luckyboy.me',
    href: 'https://luckyboy.me/',
  })
})

test('an explicit HTTP localhost URL remains usable for local development', () => {
  assert.deepEqual(siteUrlInfo('http://localhost:3000/'), {
    configured: true,
    display: 'localhost:3000',
    href: 'http://localhost:3000/',
  })
})

test('site URL helper functions share the same validation rules', () => {
  assert.equal(hasSiteUrl('example.com'), true)
  assert.equal(siteHref('example.com'), 'https://example.com/')
  assert.equal(siteDisplayUrl('example.com'), 'example.com')
  assert.equal(hasSiteUrl('https://example.com/path', 'site-1'), true)
  assert.equal(siteHref('https://example.com/path/', 'site-1'), 'https://example.com/path/')
  assert.equal(siteDisplayUrl('https://example.com/path/', 'site-1'), 'example.com/path')
})

test('unsafe or malformed site values remain unconfigured', () => {
  for (const domain of ['example', 'https://user:pass@example.com', 'ftp://example.com']) {
    assert.equal(hasSiteUrl(domain), false)
  }
})
