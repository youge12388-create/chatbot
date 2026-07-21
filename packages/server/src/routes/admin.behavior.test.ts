import assert from 'node:assert/strict'
import test from 'node:test'
import router from './admin'
import { prisma } from '../db/client'
import { authService } from '../services/auth'
import { chatService } from '../services/chat'

const adminUser = { id: 'admin-1', username: 'admin', role: 'admin', name: 'Admin' }

type Stub = { object: object; key: string; value: unknown }
function withStubs(stubs: Stub[]) {
  const restores = stubs.map(({ object, key, value }) => {
    const target = object as Record<string, unknown>
    const original = target[key]
    target[key] = value
    return () => { target[key] = original }
  })
  return () => restores.reverse().forEach(restore => restore())
}

function findRoute(method: string, path: string): any {
  const layer = (router as any).stack.find((item: any) => item.route?.path === path && item.route.methods?.[method])
  assert.ok(layer, `route not found: ${method} ${path}`)
  return layer.route
}

async function callRoute(method: string, path: string, options: { body?: any; params?: any; query?: any; user?: any } = {}) {
  const route = findRoute(method, path)
  const handler = route.stack[route.stack.length - 1].handle
  return new Promise<{ statusCode: number; body: any; headers: Record<string, string>; sent?: any }>((resolve, reject) => {
    const result = { statusCode: 200, body: undefined as any, headers: {} as Record<string, string>, sent: undefined as any }
    const req: any = {
      body: options.body || {}, params: options.params || {}, query: options.query || {},
      headers: { authorization: 'Bearer test' }, user: options.user || adminUser,
    }
    const res: any = {
      status(code: number) { result.statusCode = code; return res },
      json(body: any) { result.body = body; resolve(result); return res },
      send(body: any) { result.sent = body; resolve(result); return res },
      setHeader(name: string, value: string) { result.headers[name] = value; return res },
    }
    const next = (error?: unknown) => { if (error) reject(error) }
    try {
      const pending = handler(req, res, next)
      if (pending?.catch) pending.catch(reject)
    } catch (error) { reject(error) }
  })
}

test('login validates credentials and returns the auth result', async () => {
  const restore = withStubs([{ object: authService, key: 'login', value: async () => ({ token: 'jwt', user: adminUser }) }])
  try {
    const missing = await callRoute('post', '/login', { body: {} })
    assert.equal(missing.statusCode, 400)
    const success = await callRoute('post', '/login', { body: { username: 'admin', password: 'secret' } })
    assert.deepEqual(success.body, { code: 0, data: { token: 'jwt', user: adminUser } })
  } finally { restore() }

  const failedRestore = withStubs([{ object: authService, key: 'login', value: async () => null }])
  try { assert.equal((await callRoute('post', '/login', { body: { username: 'admin', password: 'wrong' } })).statusCode, 401) } finally { failedRestore() }
})

test('notification replay validates dates and maps message metadata', async () => {
  const restore = withStubs([{ object: prisma.message, key: 'findMany', value: async () => [{
    id: 'm1', conversationId: 'c1', content: 'hello', createdAt: new Date('2026-01-01'), conversation: { siteId: 's1', status: 'active' },
  }] }])
  try {
    assert.equal((await callRoute('get', '/notifications')).statusCode, 400)
    assert.equal((await callRoute('get', '/notifications', { query: { siteId: 's1', since: 'invalid' } })).statusCode, 400)
    const result = await callRoute('get', '/notifications', { query: { siteId: 's1', since: '2025-01-01' } })
    assert.deepEqual(result.body.data[0], { id: 'm1', conversationId: 'c1', content: 'hello', createdAt: new Date('2026-01-01'), siteId: 's1', conversationStatus: 'active' })
  } finally { restore() }
})

test('lead list, detail, update and export handlers return data', async () => {
  const lead = { id: 'l1', name: 'Name', status: 'new', createdAt: new Date('2026-01-01'), conversation: { siteId: 's1', interestLevel: 'high', status: 'active', createdAt: new Date(), lastMessageAt: new Date(), site: { name: 'Site', domain: 'example.com' } } }
  const restores = withStubs([
    { object: prisma.lead, key: 'count', value: async () => 1 },
    { object: prisma.lead, key: 'findMany', value: async () => [lead] },
    { object: prisma.lead, key: 'findUnique', value: async () => lead },
    { object: prisma.lead, key: 'update', value: async ({ data }: any) => ({ ...lead, ...data }) },
  ])
  try {
    const list = await callRoute('get', '/leads', { query: { page: '2', size: '10', status: 'new', search: 'Name', siteId: 's1' } })
    assert.equal(list.body.data.totalPages, 1)
    assert.equal((await callRoute('get', '/leads/:id', { params: { id: 'l1' } })).body.data.id, 'l1')
    const updated = await callRoute('patch', '/leads/:id', { params: { id: 'l1' }, body: { status: 'contacted', note: 'done', assignedTo: 'u1' } })
    assert.equal(updated.body.data.status, 'contacted')
    const exported = await callRoute('get', '/leads/export', { query: { siteId: 's1' } })
    assert.equal(exported.headers['Content-Type'], 'text/csv; charset=utf-8')
    assert.match(exported.sent, /example.com/)
  } finally { restores() }

  const missing = withStubs([{ object: prisma.lead, key: 'findUnique', value: async () => null }])
  try { assert.equal((await callRoute('get', '/leads/:id', { params: { id: 'missing' } })).statusCode, 404) } finally { missing() }
})

test('conversation list, detail and operator actions work', async () => {
  const conversation = { id: 'c1', siteId: 's1', visitorId: 'visitor-1', status: 'active', messages: [], leads: [], site: { name: 'Site', domain: 'example.com' } }
  let findManyCalls = 0
  const restores = withStubs([
    { object: prisma.conversation, key: 'count', value: async () => 1 },
    { object: prisma.conversation, key: 'findMany', value: async (args: any) => args.select ? [{ id: 'c1', siteId: 's1', visitorId: 'visitor-1' }] : (findManyCalls++ === 0 ? [conversation] : [{ id: 'c1', siteId: 's1', visitorId: 'visitor-1' }]) },
    { object: prisma.conversation, key: 'findUnique', value: async () => conversation },
    { object: prisma.conversation, key: 'updateMany', value: async () => ({ count: 1 }) },
    { object: prisma.conversation, key: 'update', value: async ({ data }: any) => ({ ...conversation, ...data }) },
    { object: chatService, key: 'takeOver', value: async () => {} },
    { object: chatService, key: 'releaseTakeOver', value: async () => {} },
    { object: chatService, key: 'saveMessage', value: async () => ({ id: 'm1', createdAt: new Date() }) },
  ])
  try {
    const list = await callRoute('get', '/conversations', { query: { page: '1', size: '20', status: 'active', siteId: 's1' } })
    assert.equal(list.body.data.list[0].visitorNumber, 1)
    assert.equal((await callRoute('get', '/conversations/:id', { params: { id: 'c1' } })).body.data.id, 'c1')
    assert.equal((await callRoute('post', '/conversations/:id/reply', { params: { id: 'c1' }, body: { content: 'Reply' } })).body.code, 0)
    assert.equal((await callRoute('post', '/conversations/:id/takeover', { params: { id: 'c1' } })).body.code, 0)
    assert.equal((await callRoute('post', '/conversations/:id/release', { params: { id: 'c1' } })).body.code, 0)
    assert.equal((await callRoute('post', '/conversations/:id/resolve', { params: { id: 'c1' } })).body.code, 0)
    assert.equal((await callRoute('post', '/conversations/:id/reopen', { params: { id: 'c1' } })).body.code, 0)
  } finally { restores() }

  const missing = withStubs([{ object: prisma.conversation, key: 'findUnique', value: async () => null }])
  try { assert.equal((await callRoute('get', '/conversations/:id', { params: { id: 'missing' } })).statusCode, 404) } finally { missing() }
})

test('assignee and bulk resolve handlers enforce input and update records', async () => {
  const restores = withStubs([
    { object: prisma.adminUser, key: 'findUnique', value: async () => ({ id: 'staff-1' }) },
    { object: prisma.conversation, key: 'update', value: async () => ({ assignee: { id: 'staff-1' } }) },
    { object: prisma.conversation, key: 'updateMany', value: async () => ({ count: 2 }) },
  ])
  try {
    assert.equal((await callRoute('patch', '/conversations/:id/assignee', { params: { id: 'c1' }, body: { assigneeId: 42 } })).statusCode, 400)
    assert.equal((await callRoute('patch', '/conversations/:id/assignee', { params: { id: 'c1' }, body: { assigneeId: 'staff-1' } })).body.code, 0)
    assert.equal((await callRoute('patch', '/conversations/:id/assignee', { params: { id: 'c1' }, body: { assigneeId: null } })).body.code, 0)
    assert.equal((await callRoute('post', '/conversations/bulk-resolve', { body: { ids: ['c1', 'c1', '', 4] } })).body.data.count, 2)
    assert.equal((await callRoute('post', '/conversations/bulk-resolve', { body: { ids: [] } })).statusCode, 400)
  } finally { restores() }
})

test('site create, list, update and delete handlers cover admin CRUD', async () => {
  const site = { id: 'site-1234', name: 'Site', domain: 'example.com', apiKey: 'site-key' }
  const tx = {
    site: {
      update: async ({ data }: any) => ({ ...site, ...data }),
      findUnique: async () => site,
      create: async () => site,
      delete: async () => site,
    },
    faq: { updateMany: async () => ({ count: 0 }), deleteMany: async () => ({ count: 0 }) },
    conversation: { updateMany: async () => ({ count: 0 }), findMany: async () => [], deleteMany: async () => ({ count: 0 }) },
    message: { deleteMany: async () => ({ count: 0 }) },
    lead: { deleteMany: async () => ({ count: 0 }) },
  }
  const restores = withStubs([
    { object: prisma.site, key: 'findMany', value: async () => [site] },
    { object: prisma.site, key: 'findUnique', value: async () => ({ id: site.id, domain: site.domain, settings: {} }) },
    { object: prisma.site, key: 'create', value: async () => site },
    { object: prisma.site, key: 'count', value: async () => 2 },
    { object: prisma, key: '$transaction', value: async (callback: any) => callback(tx) },
  ])
  try {
    assert.equal((await callRoute('get', '/sites')).body.data.length, 1)
    assert.equal((await callRoute('post', '/sites', { body: { name: '', domain: 'example.com' } })).statusCode, 400)
    assert.equal((await callRoute('post', '/sites', { body: { name: 'New Site', domain: 'example.com' } })).statusCode, 201)
    assert.equal((await callRoute('patch', '/sites/:id', { params: { id: site.id }, body: { name: 'Renamed', domain: 'new.example.com', settings: { x: 1 } } })).body.code, 0)
    assert.equal((await callRoute('delete', '/sites/:id', { params: { id: site.id } })).body.code, 0)
  } finally { restores() }
})

test('FAQ and user CRUD handlers return validation errors and success responses', async () => {
  const restores = withStubs([
    { object: prisma.faq, key: 'findMany', value: async () => [{ id: 'f1' }] },
    { object: prisma.faq, key: 'create', value: async ({ data }: any) => ({ id: 'f1', ...data }) },
    { object: prisma.faq, key: 'update', value: async ({ data }: any) => ({ id: 'f1', ...data }) },
    { object: prisma.faq, key: 'delete', value: async () => ({ id: 'f1' }) },
    { object: prisma.faq, key: 'findMany', value: async () => [{ id: 'f1' }, { id: 'f2' }] },
    { object: prisma.adminUser, key: 'findUnique', value: async () => null },
    { object: prisma, key: '$transaction', value: async (items: any) => Array.isArray(items) ? Promise.all(items) : items(tx) },
    { object: prisma.adminUser, key: 'findMany', value: async () => [{ id: 'admin-1' }] },
    { object: prisma.adminUser, key: 'findUnique', value: async () => null },
    { object: authService, key: 'createUser', value: async () => ({ id: 'u1', username: 'staff', role: 'staff', name: null }) },
    { object: prisma.adminUser, key: 'update', value: async () => ({}) },
    { object: prisma.adminUser, key: 'delete', value: async () => ({}) },
    { object: authService, key: 'changePassword', value: async () => {} },
  ])
  const tx = { faq: { update: async () => ({}) } }
  try {
    assert.equal((await callRoute('get', '/faqs')).body.code, 0)
    assert.equal((await callRoute('post', '/faqs', { body: {} })).statusCode, 400)
    assert.equal((await callRoute('post', '/faqs', { body: { siteId: 's1', question: 'Q', answer: 'A' } })).body.code, 0)
    assert.equal((await callRoute('patch', '/faqs/:id', { params: { id: 'f1' }, body: { answer: 'B' } })).body.code, 0)
    assert.equal((await callRoute('delete', '/faqs/:id', { params: { id: 'f1' } })).body.code, 0)
    assert.equal((await callRoute('post', '/faqs/reorder', { body: { siteId: 's1', language: 'en', orderedIds: ['f1', 'f2'] } })).body.code, 0)
    assert.equal((await callRoute('get', '/users')).body.code, 0)
    assert.equal((await callRoute('post', '/users', { body: {} })).statusCode, 400)
    assert.equal((await callRoute('post', '/users', { body: { username: 'staff', password: 'secret' } })).body.code, 0)
    assert.equal((await callRoute('patch', '/users/:id', { params: { id: 'u1' }, body: { password: 'new', role: 'staff' } })).body.code, 0)
    assert.equal((await callRoute('delete', '/users/:id', { params: { id: 'u1' } })).body.code, 0)
  } finally { restores() }
})
test('admin CRUD validation covers conflicts, forbidden changes and missing records', async () => {
  const site = { id: 'site-1234', name: 'Site', domain: 'example.com', apiKey: 'site-key' }
  const transaction = async (callback: any) => callback({
    site: {
      findUnique: async ({ where }: any) => where.id === 'site-1234' ? site : { id: where.id },
      update: async () => site,
      create: async () => site,
    },
    faq: { updateMany: async () => ({}) }, conversation: { updateMany: async () => ({}) },
  })
  const restores = withStubs([
    { object: prisma.site, key: 'findUnique', value: async () => site },
    { object: prisma.site, key: 'count', value: async () => 1 },
    { object: prisma.site, key: 'create', value: async () => { throw { code: 'P2002' } } },
    { object: prisma, key: '$transaction', value: transaction },
  ])
  try {
    assert.equal((await callRoute('post', '/sites', { body: { name: 'New', domain: 'bad' } })).statusCode, 400)
    assert.equal((await callRoute('post', '/sites', { body: { name: 'New', domain: 'example.com' } })).statusCode, 409)
    assert.equal((await callRoute('patch', '/sites/:id', { params: { id: site.id }, user: { ...adminUser, role: 'staff' }, body: { id: 'new-site' } })).statusCode, 403)
    assert.equal((await callRoute('patch', '/sites/:id', { params: { id: site.id }, body: { id: 'bad' } })).statusCode, 400)
    assert.equal((await callRoute('patch', '/sites/:id', { params: { id: site.id }, user: { ...adminUser, role: 'staff' }, body: { apiKey: 'new-api-key-123456' } })).statusCode, 403)
    assert.equal((await callRoute('patch', '/sites/:id', { params: { id: site.id }, body: { apiKey: 'short' } })).statusCode, 400)
    assert.equal((await callRoute('patch', '/sites/:id', { params: { id: site.id }, body: { domain: 'not-a-domain' } })).statusCode, 400)
    assert.equal((await callRoute('delete', '/sites/:id', { params: { id: site.id } })).statusCode, 400)
  } finally { restores() }

  const missing = withStubs([{ object: prisma.site, key: 'findUnique', value: async () => null }])
  try { assert.equal((await callRoute('delete', '/sites/:id', { params: { id: 'missing' } })).statusCode, 404) } finally { missing() }
})

test('conversation and FAQ validation branches reject malformed input', async () => {
  const restores = withStubs([
    { object: prisma.conversation, key: 'findUnique', value: async () => null },
    { object: prisma.faq, key: 'findMany', value: async () => [{ id: 'f1' }, { id: 'f2' }] },
    { object: prisma.adminUser, key: 'findUnique', value: async () => null },
  ])
  try {
    assert.equal((await callRoute('post', '/conversations/:id/reply', { params: { id: 'c1' }, body: {} })).statusCode, 400)
    assert.equal((await callRoute('post', '/conversations/:id/reply', { params: { id: 'c1' }, body: { content: 'reply' } })).statusCode, 404)
    assert.equal((await callRoute('post', '/conversations/:id/resolve', { params: { id: 'missing' } })).statusCode, 404)
    assert.equal((await callRoute('post', '/conversations/:id/reopen', { params: { id: 'missing' } })).statusCode, 404)
    assert.equal((await callRoute('patch', '/conversations/:id/assignee', { params: { id: 'c1' }, body: { assigneeId: 'missing' } })).statusCode, 404)
    assert.equal((await callRoute('post', '/conversations/bulk-resolve', { body: { ids: Array.from({ length: 101 }, (_, i) => `c${i}`) } })).statusCode, 400)
    assert.equal((await callRoute('post', '/faqs/reorder', { body: { siteId: 's1', language: 'en', orderedIds: ['f1', 'f1'] } })).statusCode, 400)
    assert.equal((await callRoute('post', '/faqs/reorder', { body: { siteId: 's1', language: 'en', orderedIds: ['f1'] } })).statusCode, 400)
  } finally { restores() }
})

test('wecom and Dify test endpoints cover configuration and upstream failures', async () => {
  const originalFetch = globalThis.fetch
  const siteRestore = withStubs([{ object: prisma.site, key: 'findUnique', value: async () => ({ settings: {} }) }])
  try {
    assert.equal((await callRoute('post', '/sites/:id/test-wecom', { params: { id: 's1' } })).statusCode, 400)
  } finally { siteRestore() }

  const missingSite = withStubs([{ object: prisma.site, key: 'findUnique', value: async () => null }])
  try { assert.equal((await callRoute('post', '/sites/:id/test-dify', { params: { id: 's1' } })).statusCode, 404) } finally { missingSite() }

  const configMissing = withStubs([{ object: prisma.site, key: 'findUnique', value: async () => ({ settings: {} }) }])
  try { assert.equal((await callRoute('post', '/sites/:id/test-dify', { params: { id: 's1' } })).statusCode, 400) } finally { configMissing() }

  const configured = withStubs([{ object: prisma.site, key: 'findUnique', value: async () => ({ settings: { difyApiUrl: 'https://dify.example.com/v1', difyApiKey: 'key' } }) }])
  try {
    globalThis.fetch = (async () => new Response('', { status: 401 })) as typeof fetch
    assert.equal((await callRoute('post', '/sites/:id/test-dify', { params: { id: 's1' } })).statusCode, 400)
    globalThis.fetch = (async () => new Response('', { status: 503 })) as typeof fetch
    assert.equal((await callRoute('post', '/sites/:id/test-dify', { params: { id: 's1' } })).statusCode, 502)
    globalThis.fetch = (async () => new Response(JSON.stringify({ mode: 'chat' }), { status: 200 })) as typeof fetch
    assert.equal((await callRoute('post', '/sites/:id/test-dify', { params: { id: 's1' } })).body.data.mode, 'chat')
  } finally { configured(); globalThis.fetch = originalFetch }

  const wecom = withStubs([{ object: prisma.site, key: 'findUnique', value: async () => ({ settings: { webhookUrl: 'https://wecom.example.com' } }) }])
  try {
    globalThis.fetch = (async () => new Response('fail', { status: 500 })) as typeof fetch
    assert.equal((await callRoute('post', '/sites/:id/test-wecom', { params: { id: 's1' } })).statusCode, 502)
    globalThis.fetch = (async () => new Response(JSON.stringify({ errcode: 0 }), { status: 200 })) as typeof fetch
    assert.equal((await callRoute('post', '/sites/:id/test-wecom', { params: { id: 's1' } })).body.code, 0)
  } finally { wecom(); globalThis.fetch = originalFetch }
})

test('user validation rejects duplicates and self deletion', async () => {
  const duplicate = withStubs([{ object: prisma.adminUser, key: 'findUnique', value: async () => ({ id: 'u1' }) }])
  try { assert.equal((await callRoute('post', '/users', { body: { username: 'admin', password: 'secret' } })).statusCode, 409) } finally { duplicate() }

  const self = withStubs([{ object: prisma.adminUser, key: 'delete', value: async () => ({}) }])
  try { assert.equal((await callRoute('delete', '/users/:id', { params: { id: adminUser.id } })).statusCode, 400) } finally { self() }
})