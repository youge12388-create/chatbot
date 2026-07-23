import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildDifyRequestBody,
  classifyQuestion,
  getAiFallbackReply,
  getTransferReply,
  getDifyInfoUrl,
  getFaqPool,
  normalizeLang,
  getPublicSiteSettings,
  normalizeDifyApiUrl,
  parseDifySse,
  shouldResetDifyConversation,
  isNoAnswerReply,
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
  assert.deepEqual(settings.welcomeMessage, { 'zh-CN': '欢迎' })
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

test('FAQ 按请求语言读取，并在缺少翻译时回退中文', async () => {
  const requestedLanguages: string[] = []
  const client = {
    faq: {
      findMany: async ({ where }: { where: { siteId: string; language: string } }) => {
        requestedLanguages.push(`${where.siteId}:${where.language}`)
        if (where.language === 'zh-CN') {
          return [{ id: 'faq-zh', language: 'zh-CN', question: '中文问题', answer: '中文答案', priority: 1 }]
        }
        return []
      },
    },
    site: {
      findUnique: async () => ({ id: 'default-site' }),
    },
  } as unknown as Parameters<typeof getFaqPool>[2]

  const faqs = await getFaqPool('custom-site', 'en', 10, client)

  assert.equal(normalizeLang('pt-BR'), 'zh-CN')
  assert.deepEqual(requestedLanguages, ['custom-site:en', 'custom-site:zh-CN'])
  assert.equal(faqs[0].language, 'zh-CN')
})

test('AI 无法回答文案应触发计数', () => {
  assert.equal(isNoAnswerReply('抱歉，我暂时无法回答这个问题'), true)
  assert.equal(isNoAnswerReply('这是一个正常的课程费用说明'), false)
})

test('legacy site copy is normalized to localized settings', () => {
  const settings = getPublicSiteSettings({
    welcomeMessage: 'legacy welcome',
    guideMessage: 'legacy guide',
    bubbleMessages: ['legacy bubble 1', 'legacy bubble 2'],
  })

  assert.deepEqual(settings.welcomeMessage, { 'zh-CN': 'legacy welcome' })
  assert.deepEqual(settings.guideMessage, { 'zh-CN': 'legacy guide' })
  assert.deepEqual(settings.bubbleMessages, { 'zh-CN': ['legacy bubble 1', 'legacy bubble 2'] })
})

test('question classification keeps transfer and personalization priority', () => {
  assert.equal(classifyQuestion('人工客服').type, 'transfer')
  assert.equal(classifyQuestion('我的 GPA').type, 'personalized')
  assert.equal(classifyQuestion('学费是多少').type, 'faq')
  assert.equal(classifyQuestion('请介绍一下学校').type, 'knowledge')
})

test('AI fallback replies normalize language and cover transfer-facing failures', () => {
  assert.match(getAiFallbackReply('en-US', 'unconfigured'), /AI service is not configured/)
  assert.match(getAiFallbackReply('en-US', 'timeout'), /AI service|AI response/)
  assert.match(getAiFallbackReply('zh-CN', 'noAnswer'), /无法回答/)
  assert.match(getTransferReply('en'), /forwarded to a consultant/)
  assert.notEqual(getTransferReply('unknown'), '')
})

test('Dify SSE parser ignores malformed blocks and raises provider errors', () => {
  assert.deepEqual(parseDifySse('data: not-json\n\ndata: [DONE]\n\n'), { answer: '', conversationId: null })
  assert.throws(
    () => parseDifySse('data: {"event":"error","message":"upstream failed"}\n\n'),
    /upstream failed/,
  )
})