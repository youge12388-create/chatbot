import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildDifyRequestBody,
  getFaqPool,
  normalizeDifyApiUrl,
  shouldResetDifyConversation,
} from './chat'

test('Dify 首次请求使用空 conversation_id', () => {
  const body = buildDifyRequestBody('你好', null, 'local-conversation-id')

  assert.equal(body.conversation_id, '')
})

test('Dify 后续请求复用服务端返回的 conversation_id', () => {
  const body = buildDifyRequestBody('继续咨询', 'dify-conversation-id', 'local-conversation-id')

  assert.equal(body.conversation_id, 'dify-conversation-id')
  assert.equal(body.user, 'local-conversation-id')
})

test('Dify 基础地址自动补全聊天接口路径', () => {
  assert.equal(
    normalizeDifyApiUrl('https://dify.example.com'),
    'https://dify.example.com/v1/chat-messages',
  )
  assert.equal(
    normalizeDifyApiUrl('https://dify.example.com/v1/'),
    'https://dify.example.com/v1/chat-messages',
  )
  assert.equal(
    normalizeDifyApiUrl('https://dify.example.com/v1/chat-messages/'),
    'https://dify.example.com/v1/chat-messages',
  )
})

test('更换 Dify 智能体后仅对失效的旧会话重建', () => {
  assert.equal(
    shouldResetDifyConversation(404, '{"message":"Conversation Not Exists."}', 'old-id'),
    true,
  )
  assert.equal(shouldResetDifyConversation(401, 'unauthorized', 'old-id'), false)
  assert.equal(shouldResetDifyConversation(404, 'route not found', 'old-id'), false)
  assert.equal(shouldResetDifyConversation(404, 'Conversation Not Exists.', null), false)
})

test('空站点继承后台可编辑的默认站点 FAQ', async () => {
  const defaultFaqs = [
    { id: 'faq-1', siteId: 'default-site', question: '学费大概多少？', answer: '后台修改后的答案', priority: 1 },
  ]
  const client = {
    faq: {
      findMany: async ({ where }: { where: { siteId: string } }) => (
        where.siteId === 'default-site' ? defaultFaqs : []
      ),
    },
    site: {
      findUnique: async () => ({ id: 'default-site' }),
    },
  } as unknown as Parameters<typeof getFaqPool>[2]

  const faqs = await getFaqPool('empty-widget-site', 10, client)

  assert.deepEqual(faqs, defaultFaqs)
})

test('当前站点有 FAQ 时不读取默认站点', async () => {
  const siteFaqs = [
    { id: 'faq-2', siteId: 'custom-site', question: '自定义问题', answer: '自定义答案', priority: 1 },
  ]
  let defaultSiteQueried = false
  const client = {
    faq: {
      findMany: async () => siteFaqs,
    },
    site: {
      findUnique: async () => {
        defaultSiteQueried = true
        return { id: 'default-site' }
      },
    },
  } as unknown as Parameters<typeof getFaqPool>[2]

  const faqs = await getFaqPool('custom-site', 10, client)

  assert.deepEqual(faqs, siteFaqs)
  assert.equal(defaultSiteQueried, false)
})
