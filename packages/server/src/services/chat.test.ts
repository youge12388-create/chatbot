import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildDifyRequestBody,
  getDifyInfoUrl,
  getFaqPool,
  getPublicSiteSettings,
  normalizeDifyApiUrl,
  parseDifySse,
  shouldResetDifyConversation,
} from './chat'

test('Dify streaming 请求会拼接 Agent 消息并保存会话 ID', () => {
  const result = parseDifySse(
    'data: {"event":"agent_message","conversation_id":"dify-1","answer":"你好"}\n\n' +
    'data: {"event":"message","conversation_id":"dify-1","answer":"，这里是答案"}\n\n',
  )

  assert.equal(result.answer, '你好，这里是答案')
  assert.equal(result.conversationId, 'dify-1')
})

test('公开站点配置不会暴露 Dify Key、Webhook 或 n8n 地址', () => {
  const settings = getPublicSiteSettings({
    welcomeMessage: '欢迎',
    difyApiUrl: 'https://api.dify.ai/v1/chat-messages',
    difyApiKey: 'app-test-secret',
    webhookUrl: 'https://example.com/wecom',
    n8nWebhookUrl: 'https://example.com/n8n',
  })

  assert.equal(settings.difyApiKey, undefined)
  assert.equal(settings.difyApiUrl, undefined)
  assert.equal(settings.webhookUrl, undefined)
  assert.equal(settings.n8nWebhookUrl, undefined)
  assert.equal(settings.welcomeMessage, '欢迎')
})
test('Dify 首次请求使用空 conversation_id', () => {
  const body = buildDifyRequestBody('你好', null, 'local-conversation-id')

  assert.equal(body.conversation_id, '')
  assert.equal(body.response_mode, 'streaming')
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
  assert.equal(
    getDifyInfoUrl('https://dify.example.com/v1/chat-messages'),
    'https://dify.example.com/v1/info',
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
