import assert from 'node:assert/strict'
import test from 'node:test'
import { postJson } from './lead'

test('企业微信返回业务错误时通知应判定失败', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => new Response(
    JSON.stringify({ errcode: 40058, errmsg: 'invalid webhook' }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )) as typeof fetch

  try {
    const result = await postJson('https://example.com/wecom', { msgtype: 'text' })
    assert.equal(result.ok, false)
    assert.equal(result.status, 200)
    assert.equal(result.message, 'invalid webhook')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('企业微信返回 errcode=0 时通知应判定成功', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => new Response(
    JSON.stringify({ errcode: 0, errmsg: 'ok' }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )) as typeof fetch

  try {
    const result = await postJson('https://example.com/wecom', { msgtype: 'text' })
    assert.equal(result.ok, true)
    assert.equal(result.status, 200)
  } finally {
    globalThis.fetch = originalFetch
  }
})