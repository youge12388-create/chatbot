import assert from 'node:assert/strict'
import test from 'node:test'
import { isAllowedWebhookUrl, normalizeLeadInput, postJson } from './lead'

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
test('线索输入使用白名单并兼容将 applyingLevel 写入 extra', () => {
  const result = normalizeLeadInput({
    name: ' 游sir ',
    applyingLevel: 'Master',
    extra: { f_custom: 'value' },
  })

  assert.deepEqual(result.fields, { name: '游sir' })
  assert.deepEqual(result.extra, {
    applyingLevel: 'Master',
    f_custom: 'value',
  })
})

test('线索输入拒绝未知字段和超长字段', () => {
  assert.throws(
    () => normalizeLeadInput({ name: 'Alice', role: 'admin' }),
    /不支持的线索字段/,
  )
  assert.throws(
    () => normalizeLeadInput({ name: 'x'.repeat(101) }),
    /长度不能超过 100/,
  )
})

test('生产环境只允许 HTTPS 且匹配 webhook 主机白名单', () => {
  const oldNodeEnv = process.env.NODE_ENV
  const oldHosts = process.env.WEBHOOK_ALLOWED_HOSTS
  process.env.NODE_ENV = 'production'
  process.env.WEBHOOK_ALLOWED_HOSTS = 'hooks.example.com'

  try {
    assert.equal(isAllowedWebhookUrl('https://hooks.example.com/path'), true)
    assert.equal(isAllowedWebhookUrl('https://other.example.com/path'), false)
    assert.equal(isAllowedWebhookUrl('http://hooks.example.com/path'), false)
  } finally {
    if (oldNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = oldNodeEnv
    if (oldHosts === undefined) delete process.env.WEBHOOK_ALLOWED_HOSTS
    else process.env.WEBHOOK_ALLOWED_HOSTS = oldHosts
  }
})