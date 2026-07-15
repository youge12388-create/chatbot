/**
 * 聊天核心服务
 *
 * 职责：
 * - 会话管理
 * - 问题分类路由
 * - Dify 对接
 * - 表单触发判断
 */

import { prisma } from '../db/client'

// ---- 类型 ----

interface QuestionCategory {
  type: 'faq' | 'knowledge' | 'personalized' | 'transfer'
  answer?: string
}

// ---- 问题分类 ----

/** 关键词路由表：根据用户消息判断问题类型 */
const ROUTE_RULES: Record<string, string[]> = {
  faq: [
    '费用', '多少钱', '价格', '学费',
    '条件', '要求', '申请', '门槛',
    '奖学金', '补助',
    '专业', '推荐',
    '语言', '英语', '雅思', '托福',
    '排名', '怎么样',
    '地址', '联系方式', '电话',
  ],
  personalized: [
    '我的', '我的情况', '我的背景',
    'GPA', '成绩', '绩点',
    '本科', '大专', '硕士', '高中',
    '预算', '能申请', '适合',
  ],
  transfer: [
    '人工', '客服', '老师', '联系',
    '电话', '回电', '加微信', '面谈',
    '报名', '签约',
  ],
}

function classifyQuestion(content: string): QuestionCategory {
  const text = content

  // 转人工关键词
  for (const kw of ROUTE_RULES.transfer) {
    if (text.includes(kw)) return { type: 'transfer' }
  }
  // 个性化咨询
  for (const kw of ROUTE_RULES.personalized) {
    if (text.includes(kw)) return { type: 'personalized' }
  }
  // 高频问题
  for (const kw of ROUTE_RULES.faq) {
    if (text.includes(kw)) return { type: 'faq' }
  }
  // 默认走知识库
  return { type: 'knowledge' }
}

// ---- 表单触发判断 ----

/** 根据会话消息数判断是否触发表单引导 */
async function shouldShowForm(conversationId: string): Promise<boolean> {
  const count = await prisma.message.count({
    where: { conversationId, role: 'user' },
  })
  // 用户发言超过 3 轮后，引导留资
  return count >= 3
}

// ---- 会话管理 ----

/** 默认站点配置（数据库未配置时兜底） */
const DEFAULT_SITE_SETTINGS = {
  welcomeMessage: '您好！我是留学顾问助手，可以帮您解答院校申请、专业选择、学费奖学金等问题。有什么可以帮您的？',
  guideMessage: '您可以直接输入问题，或点击下方常见问题快速咨询。',
  bubbleMessages: [
    '有问题？点击这里随时咨询 👋',
    '免费咨询院校申请、专业选择',
    '点击聊聊，专属顾问为您服务',
  ],
  primaryColor: '#165DFF',
  // 联系顾问配置：未配置则不显示联系顾问按钮
  contactWhatsApp: '',    // 国际格式号码，如 8613800138000，前端拼 wa.me/链接
  contactWecomQrUrl: '',  // 企微二维码图片 URL
  // 表单配置：预设字段开关 + 自定义字段
  formConfig: {
    presetFields: {
      name:          { enabled: true,  required: true },
      phone:         { enabled: true,  required: true },
      applyingLevel: { enabled: true,  required: false }, // 申请学历层次：本科/硕士/博士/预科/语言班
      email:         { enabled: false, required: false },
      wechat:        { enabled: false, required: false },
      education:     { enabled: false, required: false },
      targetMajor:   { enabled: false, required: false },
      budget:        { enabled: false, required: false },
    },
    customFields: [] as Array<{
      id: string
      label: string
      type: 'text' | 'tel' | 'email' | 'select' | 'textarea'
      options?: string[]
      required: boolean
    }>,
  },
}

/** 默认 FAQ（站点无 FAQ 时兜底，不入库，保证引导入口始终存在） */
const DEFAULT_FAQS = [
  { id: 'default-1', question: '学费大概多少？', answer: '请咨询具体项目，不同课程费用不同。', priority: 1 },
  { id: 'default-2', question: '申请条件是什么？', answer: '一般需要学历证明和语言成绩，具体视项目而定。', priority: 2 },
  { id: 'default-3', question: '有奖学金吗？', answer: '部分项目提供奖学金，欢迎留下联系方式获取详情。', priority: 3 },
]

const DEFAULT_SITE_API_KEY = 'demo-api-key-001'

type FaqLookupClient = Pick<typeof prisma, 'faq' | 'site'>

/**
 * FAQ 读取顺序：当前站点配置 -> 默认站点配置 -> 代码兜底。
 * 空站点也能复用后台可编辑的默认 FAQ，同时保留最终可用性兜底。
 */
export async function getFaqPool(
  siteId: string,
  take?: number,
  client: FaqLookupClient = prisma,
) {
  const findBySiteId = (targetSiteId: string) => client.faq.findMany({
    where: { siteId: targetSiteId },
    orderBy: { priority: 'asc' },
    ...(take === undefined ? {} : { take }),
  })

  const siteFaqs = await findBySiteId(siteId)
  if (siteFaqs.length > 0) return siteFaqs

  const defaultSite = await client.site.findUnique({
    where: { apiKey: DEFAULT_SITE_API_KEY },
    select: { id: true },
  })
  if (defaultSite && defaultSite.id !== siteId) {
    const defaultSiteFaqs = await findBySiteId(defaultSite.id)
    if (defaultSiteFaqs.length > 0) return defaultSiteFaqs
  }

  return take === undefined ? DEFAULT_FAQS : DEFAULT_FAQS.slice(0, take)
}

async function createSession(
  siteId: string,
  visitorId: string,
  metadata?: any,
  siteKey?: string,
) {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { apiKey: true, settings: true },
  })

  // 站点标识错误时拒绝创建隐式站点，避免聊天落到没有配置的站点。
  if (!site || (siteKey && site.apiKey !== siteKey)) return null

  const settings = getPublicSiteSettings(site.settings)
  const session = await prisma.conversation.create({
    data: {
      siteId,
      visitorId,
      metadata: metadata || {},
    },
  })
  return { ...session, siteSettings: settings }
}
function mergeSettings(raw: any): Record<string, any> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT_SITE_SETTINGS }
  const merged = { ...DEFAULT_SITE_SETTINGS, ...raw }
  // 兼容旧版单个 bubbleMessage 字符串：转成数组
  if (
    (!Array.isArray(merged.bubbleMessages) || merged.bubbleMessages.length === 0) &&
    typeof merged.bubbleMessage === 'string' && merged.bubbleMessage.trim()
  ) {
    merged.bubbleMessages = [merged.bubbleMessage.trim()]
  }
  if (!Array.isArray(merged.bubbleMessages) || merged.bubbleMessages.length === 0) {
    merged.bubbleMessages = [...DEFAULT_SITE_SETTINGS.bubbleMessages]
  }
  // 清理空字符串项
  merged.bubbleMessages = merged.bubbleMessages
    .map((s: any) => (typeof s === 'string' ? s.trim() : ''))
    .filter(Boolean)
  if (merged.bubbleMessages.length === 0) {
    merged.bubbleMessages = [...DEFAULT_SITE_SETTINGS.bubbleMessages]
  }
  // 移除已废弃的旧字段，避免回写时混淆
  delete merged.bubbleMessage
  // 兜底 formConfig
  if (!merged.formConfig || typeof merged.formConfig !== 'object') {
    merged.formConfig = JSON.parse(JSON.stringify(DEFAULT_SITE_SETTINGS.formConfig))
  } else {
    const fc = merged.formConfig
    if (!fc.presetFields || typeof fc.presetFields !== 'object') {
      fc.presetFields = JSON.parse(JSON.stringify(DEFAULT_SITE_SETTINGS.formConfig.presetFields))
    } else {
      // 补全缺失的预设字段
      const defaults = DEFAULT_SITE_SETTINGS.formConfig.presetFields as Record<string, any>
      for (const key of Object.keys(defaults)) {
        if (!fc.presetFields[key]) {
          fc.presetFields[key] = { ...defaults[key] }
        }
      }
    }
    if (!Array.isArray(fc.customFields)) fc.customFields = []
  }
  return merged
}

/** 公开给 Widget 的配置白名单，永不返回服务端密钥和通知 Webhook。 */
export function getPublicSiteSettings(raw: any): Record<string, any> {
  const settings = mergeSettings(raw)
  return {
    welcomeMessage: settings.welcomeMessage,
    guideMessage: settings.guideMessage,
    bubbleMessages: settings.bubbleMessages,
    primaryColor: settings.primaryColor,
    formConfig: settings.formConfig,
    contactWhatsApp: settings.contactWhatsApp,
    contactWecomQrUrl: settings.contactWecomQrUrl,
  }
}
async function getSiteSettings(siteId: string) {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { settings: true, name: true },
  })
  if (!site) return null
  return { id: siteId, name: site.name, settings: getPublicSiteSettings(site.settings) }
}

async function saveMessage(
  conversationId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  source: string,
) {
  const msg = await prisma.message.create({
    data: { conversationId, role, content, source },
  })
  // 同步更新会话最后消息时间,供后台列表排序
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: msg.createdAt },
  })
  return msg
}

// ---- Dify 对接 ----

const DIFY_TIMEOUT_MS = 15_000

const AI_FAILURE_REPLIES = new Set([
  '抱歉，AI 服务暂未配置，请联系管理员。',
  '抱歉，AI 服务暂时不可用，请稍后重试。',
  '抱歉，AI 响应超时，请稍后重试。',
  '抱歉，我暂时无法回答这个问题，请稍后重试。',
])

export function isAiFailureReply(reply: string): boolean {
  return AI_FAILURE_REPLIES.has(reply.trim())
}

export function nextAiFailureCount(current: unknown, failed: boolean): number {
  if (!failed) return 0
  const count = Number.isFinite(Number(current)) ? Math.max(0, Math.floor(Number(current))) : 0
  return count + 1
}

function getConversationMetadata(raw: unknown): Record<string, any> {
  return raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw as Record<string, any>
    : {}
}

/** 记录连续 AI 失败；达到两次后把会话交给人工，并返回是否刚刚触发转人工。 */
async function recordAiReplyOutcome(conversationId: string, failed: boolean): Promise<boolean> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { status: true, metadata: true },
  })
  if (!conversation || conversation.status !== 'active') return false

  const metadata = getConversationMetadata(conversation.metadata)
  const failureCount = nextAiFailureCount(metadata.aiFailureCount, failed)
  const nextMetadata = { ...metadata, aiFailureCount: failureCount }
  const shouldTransfer = failed && failureCount >= 2

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      metadata: nextMetadata,
      ...(shouldTransfer ? { status: 'taken_over' } : {}),
    },
  })
  return shouldTransfer
}
/**
 * 后台既可填写完整接口，也可填写 Dify API 域名或 /v1 基础地址。
 * 应用访问页（如 /chat/...）不是 API 地址，不能在这里自动转换。
 */
export function normalizeDifyApiUrl(rawUrl: string): string {
  const value = rawUrl.trim()
  const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`)
  const path = url.pathname.replace(/\/+$/, '')

  if (!path) {
    url.pathname = '/v1/chat-messages'
  } else if (path.endsWith('/v1')) {
    url.pathname = `${path}/chat-messages`
  } else {
    url.pathname = path
  }

  url.hash = ''
  return url.toString()
}

/** 由聊天接口地址推导 Dify 应用信息接口，用于后台连接测试。 */
export function getDifyInfoUrl(rawUrl: string): string {
  const url = new URL(normalizeDifyApiUrl(rawUrl))
  url.pathname = url.pathname.replace(/\/chat-messages$/, '/info')
  return url.toString()
}

export function shouldResetDifyConversation(
  status: number,
  errorBody: string,
  difyConversationId: string | null,
): boolean {
  return Boolean(
    difyConversationId &&
    (status === 400 || status === 404) &&
    /conversation(?:_id)?[^\n]*(?:not[ _-]?found|not[^\n]*exist|invalid)/i.test(errorBody),
  )
}

export function buildDifyRequestBody(
  query: string,
  difyConversationId: string | null,
  user: string,
  inputs?: Record<string, any>,
) {
  return {
    inputs: inputs || {},
    query,
    // Dify 首次请求必须为空，后续使用它返回的 conversation_id
    conversation_id: difyConversationId || '',
    user,
    response_mode: 'streaming',
  }
}

export interface DifyStreamResult {
  answer: string
  conversationId: string | null
}

/** 解析 Dify streaming 响应，兼容 message、agent_message 和错误事件。 */
export function parseDifySse(text: string): DifyStreamResult {
  let answer = ''
  let conversationId: string | null = null

  for (const block of text.split(/\r?\n\r?\n/)) {
    const data = block
      .split(/\r?\n/)
      .find(line => line.startsWith('data:'))
      ?.slice(5)
      .trim()
    if (!data || data === '[DONE]') continue

    let payload: any
    try {
      payload = JSON.parse(data)
    } catch {
      continue
    }

    if (payload.conversation_id) conversationId = payload.conversation_id
    if (payload.event === 'error') {
      throw new Error(payload.message || payload.code || 'Dify streaming error')
    }
    if (payload.event === 'message' || payload.event === 'agent_message') {
      if (typeof payload.answer === 'string') answer += payload.answer
    }
  }

  return { answer, conversationId }
}

async function readDifyStream(response: Response): Promise<DifyStreamResult> {
  return parseDifySse(await response.text())
}

/** 获取最近 N 条对话历史（用于传给 Dify 作为上下文） */
async function getRecentHistory(conversationId: string, limit = 6): Promise<string> {
  const messages = await prisma.message.findMany({
    where: { conversationId, role: { in: ['user', 'assistant'] } },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  if (messages.length === 0) return ''
  // 按时间正序排列
  messages.reverse()
  return messages
    .map(m => `${m.role === 'user' ? '用户' : '客服'}：${m.content}`)
    .join('\n')
}

async function askDify(conversationId: string, query: string, questionType?: string): Promise<string> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { metadata: true, siteId: true },
  })

  // 优先使用站点级 Dify 配置，回退到环境变量
  let url = process.env.DIFY_API_URL
  let key = process.env.DIFY_API_KEY

  if (conversation?.siteId) {
    const site = await prisma.site.findUnique({
      where: { id: conversation.siteId },
      select: { settings: true },
    })
    const siteSettings = (
      site?.settings &&
      typeof site.settings === 'object' &&
      !Array.isArray(site.settings)
    ) ? site.settings as Record<string, any> : {}

    if (typeof siteSettings.difyApiUrl === 'string' && siteSettings.difyApiUrl.trim()) {
      url = siteSettings.difyApiUrl.trim()
    }
    if (typeof siteSettings.difyApiKey === 'string' && siteSettings.difyApiKey.trim()) {
      key = siteSettings.difyApiKey.trim()
    }
  }

  if (!url || !key) {
    console.warn('[chat-api] Dify 未配置，返回兜底回复')
    return '抱歉，AI 服务暂未配置，请联系管理员。'
  }
  try {
    url = normalizeDifyApiUrl(url)
  } catch {
    console.error('[chat-api] Dify API 地址无效，请填写 API 域名或 /v1/chat-messages 接口地址')
    return '抱歉，AI 服务暂时不可用，请稍后重试。'
  }
  const metadata = (
    conversation?.metadata &&
    typeof conversation.metadata === 'object' &&
    !Array.isArray(conversation.metadata)
  ) ? conversation.metadata as Record<string, any> : {}
  const difyConversationId = typeof metadata.difyConversationId === 'string'
    ? metadata.difyConversationId : null

  // 获取最近对话历史作为上下文
  const history = await getRecentHistory(conversationId)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DIFY_TIMEOUT_MS)

  try {
    const requestDify = (currentDifyConversationId: string | null) => fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildDifyRequestBody(
        query,
        currentDifyConversationId,
        conversationId,
        {
          conversation_history: history || '',
          question_type: questionType || 'knowledge',
        },
      )),
      signal: controller.signal,
    })

    let response = await requestDify(difyConversationId)
    let errorBody = response.ok ? '' : await response.text().catch(() => '')

    if (shouldResetDifyConversation(response.status, errorBody, difyConversationId)) {
      console.warn('[chat-api] Dify 智能体已更换，旧会话失效，正在创建新会话')
      response = await requestDify(null)
      errorBody = response.ok ? '' : await response.text().catch(() => '')
    }

    if (!response.ok) {
      console.error(`[chat-api] Dify 返回 ${response.status}: ${response.statusText}`, errorBody)
      return '抱歉，AI 服务暂时不可用，请稍后重试。'
    }

    const stream = await readDifyStream(response)
    if (stream.conversationId && stream.conversationId !== difyConversationId) {
      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          metadata: { ...metadata, difyConversationId: stream.conversationId },
        },
      })
    }
    let answer = stream.answer || '抱歉，我暂时无法回答这个问题，请稍后重试。'
    // 过滤推理模型的 <think>...</think> 标签
    answer = answer.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
    return answer
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.error('[chat-api] Dify 请求超时')
      return '抱歉，AI 响应超时，请稍后重试。'
    }
    console.error('[chat-api] Dify 请求失败:', err.message)
    return '抱歉，AI 服务暂时不可用，请稍后重试。'
  } finally {
    clearTimeout(timer)
  }
}

// ---- 转人工 ----

const TRANSFER_REPLIES: Record<string, string> = {
  'zh-CN': '已将您的需求转给专业顾问，稍后会联系您。',
  'en': 'Your request has been forwarded to a consultant. We will contact you shortly.',
  'ru': 'Ваш запрос передан консультанту. Мы свяжемся с вами в ближайшее время.',
}

function getTransferReply(lang: string): string {
  return TRANSFER_REPLIES[lang] || TRANSFER_REPLIES['zh-CN']
}

async function transferToHuman(conversationId: string) {
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { status: 'taken_over' },
  })
}

// ---- 预设问题 ----

async function getFaqs(siteId: string) {
  return getFaqPool(siteId, 10)
}

/**
 * 根据用户当前问题返回 3 条推荐问题（用于动态引导）。
 * - 优先返回与用户问题关键词匹配的 FAQ
 * - 无匹配返回前 3 条（按 priority）
 * - 排除用户刚问过的问题（避免重复推荐）
 */
async function getSuggestedQuestions(
  siteId: string,
  userContent?: string,
  excludeQuestions: string[] = [],
): Promise<string[]> {
  const pool = await getFaqPool(siteId, 20)

  const excludeSet = new Set(excludeQuestions.map(q => q.trim()))
  const available = pool.filter(f => !excludeSet.has(f.question.trim()))
  if (available.length === 0) return []

  // 有关键词时按匹配度排序
  if (userContent && userContent.trim()) {
    const content = userContent.trim()
    const scored = available.map(f => {
      let score = 0
      // FAQ 问题关键词出现在用户消息中
      for (const ch of content) {
        if (f.question.includes(ch)) score += 1
      }
      // 用户消息关键词出现在 FAQ 问题中
      for (const ch of f.question) {
        if (content.includes(ch)) score += 1
      }
      return { q: f.question, score }
    })
    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, 3).map(s => s.q)
  }

  // 无关键词，返回前 3 条
  return available.slice(0, 3).map(f => f.question)
}

/** 获取会话所属站点 ID */
async function getConversationSiteId(conversationId: string): Promise<string> {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { siteId: true },
  })
  return conv?.siteId || ''
}

/** 检查会话是否已被人工接管（接管后 AI 不自动回复） */
async function isTakenOver(conversationId: string): Promise<boolean> {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { status: true },
  })
  return conv?.status === 'taken_over'
}

/** 人工接管：把会话状态改为 taken_over */
async function takeOver(conversationId: string): Promise<void> {
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { status: 'taken_over' },
  })
}

/** 释放接管：恢复 AI 自动回复 */
async function releaseTakeOver(conversationId: string): Promise<void> {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { status: true, metadata: true },
  })
  if (conv?.status === 'taken_over') {
    const metadata = getConversationMetadata(conv.metadata)
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: 'active',
        metadata: { ...metadata, aiFailureCount: 0 },
      },
    })
  }
}

/** 根据 apiKey 查找站点 */
async function findSiteByApiKey(apiKey: string) {
  return prisma.site.findUnique({ where: { apiKey } })
}

/** 根据用户消息匹配 FAQ 预设答案，无匹配返回 null */
async function findFaqAnswer(siteId: string, content: string): Promise<string | null> {
  const pool = await getFaqPool(siteId)

  for (const faq of pool) {
    // 精确匹配优先
    if (content.trim() === faq.question.trim()) {
      return faq.answer
    }
  }
  for (const faq of pool) {
    // 双向模糊匹配：用户问题包含 FAQ 问题，或 FAQ 问题包含用户问题
    if (content.includes(faq.question) || faq.question.includes(content)) {
      return faq.answer
    }
  }

  return null
}

export const chatService = {
  createSession,
  saveMessage,
  classifyQuestion,
  shouldShowForm,
  askDify,
  isAiFailureReply,
  nextAiFailureCount,
  recordAiReplyOutcome,
  getTransferReply,
  transferToHuman,
  getFaqs,
  getSuggestedQuestions,
  findFaqAnswer,
  findSiteByApiKey,
  getConversationSiteId,
  getSiteSettings,
  isTakenOver,
  takeOver,
  releaseTakeOver,
}