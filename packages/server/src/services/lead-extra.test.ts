import assert from 'node:assert/strict'
import test from 'node:test'
import { prisma } from '../db/client'
import { leadService, postJson } from './lead'

function replaceMethod(object: object, key: string, value: unknown): () => void {
  const target = object as Record<string, unknown>
  const original = target[key]
  target[key] = value
  return () => { target[key] = original }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

test('postJson handles HTTP errors, network errors and non-JSON success responses', async () => {
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = (async () => new Response('bad gateway', { status: 502, statusText: 'Bad Gateway' })) as typeof fetch
    assert.deepEqual(await postJson('https://example.com/fail', {}), { ok: false, status: 502, message: 'bad gateway' })

    globalThis.fetch = (async () => { throw new Error('offline') }) as typeof fetch
    assert.deepEqual(await postJson('https://example.com/offline', {}), { ok: false, status: 0, message: 'offline' })

    globalThis.fetch = (async () => new Response('accepted by n8n', { status: 200 })) as typeof fetch
    assert.deepEqual(await postJson('https://example.com/n8n', {}), { ok: true, status: 200, message: 'ok' })
  } finally { globalThis.fetch = originalFetch }
})

test('updateInterestScore maps all interest levels and keyword bonuses', async () => {
  const levels = ['unknown', 'low', 'normal', 'medium', 'high', 'strong']
  const updates: string[] = []
  let current = 'unknown'
  const findRestore = replaceMethod(prisma.conversation, 'findUnique', async () => ({ interestLevel: current }))
  const updateRestore = replaceMethod(prisma.conversation, 'update', async ({ data }: any) => {
    updates.push(data.interestLevel)
    return data
  })
  try {
    for (const level of levels) {
      current = level
      await leadService.updateInterestScore('conversation-1', '', 'unknown')
    }
    current = 'unknown'
    await leadService.updateInterestScore('conversation-1', 'GPA', 'knowledge')
    current = 'normal'
    await leadService.updateInterestScore('conversation-1', '鎶ュ悕', 'transfer')
    assert.deepEqual(updates.slice(0, 6), levels)
    assert.equal(updates.at(-2), 'normal')
    assert.equal(updates.at(-1), 'strong')
  } finally { findRestore(); updateRestore() }

  const missing = replaceMethod(prisma.conversation, 'findUnique', async () => null)
  const update = replaceMethod(prisma.conversation, 'update', async () => { throw new Error('should not update') })
  try { await leadService.updateInterestScore('missing', 'content', 'faq') } finally { missing(); update() }
})

test('upsertLead updates existing extra fields and creates new leads', async () => {
  const originalFind = (prisma.lead as any).findFirst
  const updateRestore = replaceMethod(prisma.lead, 'update', async ({ data }: any) => ({ id: 'lead-1', ...data }))
  const createRestore = replaceMethod(prisma.lead, 'create', async ({ data }: any) => ({ id: 'lead-2', ...data }))
  const originalFetch = globalThis.fetch
  let includeLookup = false
  ;(prisma.lead as any).findFirst = async (args: any) => {
    if (args.include) {
      includeLookup = true
      return {
        id: 'lead-1', conversationId: 'conversation-1', name: 'Old', phone: '100', email: null,
        conversation: {
          interestLevel: 'normal',
          messages: [{ role: 'user', content: 'hello' }],
          site: { settings: { n8nWebhookUrl: 'https://example.com/n8n' } },
        },
      }
    }
    return args.where.conversationId === 'conversation-1' ? { id: 'lead-1', extra: { old: 'value' } } : null
  }
  globalThis.fetch = (async () => jsonResponse({})) as typeof fetch
  try {
    const updated = await leadService.upsertLead('conversation-1', { name: 'New', phone: '13800000000', extra: { next: 'value' } })
    assert.equal(updated.id, 'lead-1')
    assert.equal(includeLookup, true)
    const created = await leadService.upsertLead('conversation-2', { name: 'Only name' })
    assert.equal(created.id, 'lead-2')
  } finally {
    ;(prisma.lead as any).findFirst = originalFind
    updateRestore(); createRestore(); globalThis.fetch = originalFetch
  }
})

test('upsertLead stores legacy applyingLevel in extra instead of sending an unknown Prisma field', async () => {
  const originalFind = (prisma.lead as any).findFirst
  const createRestore = replaceMethod(prisma.lead, 'create', async ({ data }: any) => data)
  ;(prisma.lead as any).findFirst = async () => null
  try {
    const lead = await leadService.upsertLead('conversation-3', {
      name: 'Name',
      phone: '+8613800000000',
      applyingLevel: 'Master',
    })
    assert.equal((lead as any).applyingLevel, undefined)
    assert.deepEqual(lead.extra, { applyingLevel: 'Master' })
  } finally {
    ;(prisma.lead as any).findFirst = originalFind
    createRestore()
  }
})

test('notifyNewLead and notifyTransfer handle missing webhooks and delivery outcomes', async () => {
  const originalFetch = globalThis.fetch
  const findRestore = replaceMethod(prisma.conversation, 'findUnique', async ({ include }: any) => include
    ? { id: 'conversation-1', interestLevel: 'high', messages: [], leads: [{ name: 'Name', phone: '123' }], site: { name: 'Site', domain: 'example.com', settings: {} } }
    : null)
  try {
    assert.equal(await leadService.notifyTransfer('missing'), false)
  } finally { findRestore() }

  const noWebhook = replaceMethod(prisma.conversation, 'findUnique', async () => ({
    id: 'conversation-1', interestLevel: 'normal', messages: [], leads: [], site: { name: 'Site', domain: '', settings: {} },
  }))
  try { assert.equal(await leadService.notifyTransfer('conversation-1'), false) } finally { noWebhook() }

  let calls = 0
  globalThis.fetch = (async () => { calls += 1; return jsonResponse({ errcode: 0 }) }) as typeof fetch
  const success = replaceMethod(prisma.conversation, 'findUnique', async () => ({
    id: 'conversation-1', interestLevel: 'high', messages: [{ role: 'user', content: 'hello' }], leads: [{ name: 'Name', phone: '123' }],
    site: { name: 'Site', domain: 'example.com', settings: { webhookUrl: 'https://example.com/wecom' } },
  }))
  try {
    assert.equal(await leadService.notifyTransfer('conversation-1'), true)
    assert.equal(calls, 1)
  } finally { success(); globalThis.fetch = originalFetch }
})