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
test('webhook retries transient server failures and then succeeds', async () => {
  const originalFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = (async () => {
    calls += 1
    if (calls === 1) return new Response('temporary failure', { status: 503 })
    return new Response('{}', { status: 200 })
  }) as typeof fetch

  try {
    const result = await postJson('https://example.com/retry', { event: 'test' })
    assert.equal(result.ok, true)
    assert.equal(calls, 2)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('webhook does not retry client errors', async () => {
  const originalFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = (async () => {
    calls += 1
    return new Response('invalid request', { status: 400 })
  }) as typeof fetch

  try {
    const result = await postJson('https://example.com/client-error', { event: 'test' })
    assert.equal(result.ok, false)
    assert.equal(result.status, 400)
    assert.equal(calls, 1)
  } finally {
    globalThis.fetch = originalFetch
  }
})