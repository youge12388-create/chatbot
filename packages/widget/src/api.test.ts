import assert from 'node:assert/strict'
import test from 'node:test'
import { ChatApi } from './api'

const storage = new Map<string, string>()
const originalFetch = globalThis.fetch

globalThis.localStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
} as Storage
globalThis.location = { href: 'https://example.com/page' } as Location

function response(data: unknown, ok = true) {
  return { ok, json: async () => data } as Response
}

test.afterEach(() => {
  storage.clear()
  globalThis.fetch = originalFetch
})

test('loads public site settings only after a site key is configured', async () => {
  const api = new ChatApi('https://api.example.com', 'site-1', 'en')
  assert.equal(await api.getSiteSettings(), null)

  const requests: string[] = []
  globalThis.fetch = async (input) => {
    requests.push(String(input))
    return response({ data: { settings: { primaryColor: '#000' } } })
  }
  api.setSiteKey('key with spaces')

  assert.deepEqual(await api.getSiteSettings(), { primaryColor: '#000' })
  assert.deepEqual(requests, ['https://api.example.com/api/chat/site?siteKey=key with spaces'])
})

test('creates a session and reuses its conversation for the next message', async () => {
  const api = new ChatApi('https://api.example.com', 'site-1', 'en')
  const requests: Array<{ url: string; init?: RequestInit }> = []
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), init })
    if (requests.length === 1) return response({ code: 0, data: { id: 'conversation-1' } })
    return response({ code: 0, data: { reply: 'Hello', source: 'ai', needForm: false } })
  }

  assert.deepEqual(await api.sendMessage('Hi'), { reply: 'Hello', source: 'ai', needForm: false })
  assert.equal(api.getConversationId(), 'conversation-1')
  assert.equal(requests[0].url, 'https://api.example.com/api/chat/session')
  assert.equal(requests[1].url, 'https://api.example.com/api/chat/message')
  assert.deepEqual(JSON.parse(String(requests[1].init?.body)), {
    conversationId: 'conversation-1',
    content: 'Hi',
    lang: 'en',
  })
})

test('encodes FAQ requests and sends custom lead fields as extra data', async () => {
  const api = new ChatApi('https://api.example.com', 'site id', 'zh-CN')
  const requests: Array<{ url: string; init?: RequestInit }> = []
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), init })
    return response(requests.length === 1 ? { code: 0, data: [{ id: 'faq-1' }] } : { code: 0 })
  }

  assert.deepEqual(await api.getFaqs(), [{ id: 'faq-1' }])
  await api.submitLead({ name: '游sir' }, { company: 'Example' })
  assert.equal(requests[0].url, 'https://api.example.com/api/chat/faqs?siteId=site%20id&lang=zh-CN')
  assert.deepEqual(JSON.parse(String(requests[1].init?.body)), {
    conversationId: null,
    name: '游sir',
    extra: { company: 'Example' },
  })
})

test('raises the backend error when lead submission fails', async () => {
  const api = new ChatApi('https://api.example.com', 'site-1', 'en')
  globalThis.fetch = async () => response({ code: 1, message: 'missing conversation' }, false)

  await assert.rejects(
    () => api.submitLead({ name: 'Name' }),
    { message: 'missing conversation' },
  )
})

test('uses the selected language for subsequent FAQ and message requests', async () => {
  const api = new ChatApi('https://api.example.com', 'site-1', 'en')
  const requests: Array<{ url: string; init?: RequestInit }> = []
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), init })
    if (requests.length === 1) return response({ code: 0, data: [{ id: 'faq-ko' }] })
    return response({ code: 0, data: { reply: '안녕하세요', source: 'preset', needForm: false } })
  }

  api.setLanguage('ko')
  await api.getFaqs()
  ;(api as { conversationId: string | null }).conversationId = 'conversation-1'
  await api.sendMessage('안녕하세요')

  assert.equal(requests[0].url, 'https://api.example.com/api/chat/faqs?siteId=site-1&lang=ko')
  assert.equal(JSON.parse(String(requests[1].init?.body)).lang, 'ko')
})

test('returns an empty message list without a session or when replay fails', async () => {
  const api = new ChatApi('https://api.example.com', 'site-1', 'en')
  assert.deepEqual(await api.fetchMessagesAfter(new Date().toISOString()), [])

  globalThis.fetch = async () => { throw new Error('offline') }
  ;(api as { conversationId: string | null }).conversationId = 'conversation-1'
  assert.deepEqual(await api.fetchMessagesAfter(new Date().toISOString()), [])
})