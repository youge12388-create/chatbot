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
import { normalizeSiteOrigin } from '../utils/site-domain'

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

export function classifyQuestion(content: string): QuestionCategory {
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
const AI_FALLBACK_REPLIES: Record<SupportedLang, Record<'unconfigured' | 'unavailable' | 'noAnswer' | 'timeout', string>> = {
  'zh-CN': {
    unconfigured: '抱歉，AI 服务暂未配置，请联系管理员。',
    unavailable: '抱歉，AI 服务暂时不可用，请稍后重试。',
    noAnswer: '抱歉，我暂时无法回答这个问题，请稍后重试。',
    timeout: '抱歉，AI 响应超时，请稍后重试。',
  },
  en: {
    unconfigured: 'Sorry, the AI service is not configured yet. Please contact the administrator.',
    unavailable: 'Sorry, the AI service is temporarily unavailable. Please try again later.',
    noAnswer: 'Sorry, I cannot answer this question right now. Please try again later.',
    timeout: 'Sorry, the AI response timed out. Please try again later.',
  },
  ko: {
    unconfigured: '죄송합니다. AI 서비스가 아직 설정되지 않았습니다. 관리자에게 문의해 주세요.',
    unavailable: '죄송합니다. AI 서비스를 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.',
    noAnswer: '죄송합니다. 지금은 이 질문에 답변하기 어렵습니다. 잠시 후 다시 시도해 주세요.',
    timeout: '죄송합니다. AI 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.',
  },
  ru: {
    unconfigured: 'Извините, сервис AI ещё не настроен. Обратитесь к администратору.',
    unavailable: 'Извините, сервис AI временно недоступен. Попробуйте позже.',
    noAnswer: 'Извините, сейчас я не могу ответить на этот вопрос. Попробуйте позже.',
    timeout: 'Извините, время ожидания ответа AI истекло. Попробуйте позже.',
  },
}

export function getAiFallbackReply(lang: unknown, type: keyof typeof AI_FALLBACK_REPLIES['zh-CN']): string {
  return AI_FALLBACK_REPLIES[normalizeLang(lang)][type]
}
const NO_ANSWER_PATTERNS = [
  'AI 服务尚未配置',
  'AI 服务暂时不可用',
  '暂时无法回答',
  '无法回答这个问题',
  '响应超时',
  '抱歉，我不清楚',
  '抱歉，无法',
]

export function isNoAnswerReply(reply: string): boolean {
  const text = reply.trim()
  return !text || NO_ANSWER_PATTERNS.some((pattern) => text.includes(pattern))
}

async function updateNoAnswerCount(conversationId: string, unanswered: boolean): Promise<number> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { metadata: true },
  })
  if (!conversation) return 0

  const metadata = (
    conversation.metadata &&
    typeof conversation.metadata === 'object' &&
    !Array.isArray(conversation.metadata)
  ) ? conversation.metadata as Record<string, unknown> : {}
  const previous = typeof metadata.aiNoAnswerCount === 'number' ? metadata.aiNoAnswerCount : 0
  const count = unanswered ? previous + 1 : 0
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { metadata: { ...metadata, aiNoAnswerCount: count } },
  })
  return count
}
export type SupportedLang = 'zh-CN' | 'en' | 'ko' | 'ru'

const SUPPORTED_LANGS: SupportedLang[] = ['zh-CN', 'en', 'ko', 'ru']

export function normalizeLang(value: unknown, fallback: SupportedLang = 'zh-CN'): SupportedLang {
  if (typeof value !== 'string') return fallback
  if (SUPPORTED_LANGS.includes(value as SupportedLang)) return value as SupportedLang
  const normalized = value.toLowerCase()
  if (normalized.startsWith('zh')) return 'zh-CN'
  if (normalized.startsWith('en')) return 'en'
  if (normalized.startsWith('ko')) return 'ko'
  if (normalized.startsWith('ru')) return 'ru'
  return fallback
}

const DEFAULT_SITE_SETTINGS = {
  welcomeMessage: {
    'zh-CN': '您好！我是留学顾问助手，可以帮您解答院校申请、专业选择、学费奖学金等问题。有什么可以帮您的？',
    en: 'Hello! I can help with school applications, majors, tuition and scholarships. How can I help?',
    ko: '안녕하세요! 학교 지원, 전공 선택, 학비와 장학금에 대해 도와드리겠습니다. 무엇을 도와드릴까요?',
    ru: 'Здравствуйте! Я помогу с поступлением, выбором специальности, оплатой обучения и стипендиями. Чем могу помочь?',
  },
  guideMessage: {
    'zh-CN': '您可以直接输入问题，或点击下方常见问题快速咨询。',
    en: 'Type your question or choose a common question below.',
    ko: '질문을 입력하거나 아래의 자주 묻는 질문을 선택해 주세요.',
    ru: 'Введите вопрос или выберите один из частых вопросов ниже.',
  },
  bubbleMessages: {
    'zh-CN': ['有问题？点击这里随时咨询 👋', '免费咨询院校申请、专业选择', '点击聊聊，专属顾问为您服务'],
    en: ['Have a question? Ask us anytime 👋', 'Free advice on applications and majors', 'Chat with a dedicated consultant'],
    ko: ['궁금한 점이 있나요? 언제든 문의해 주세요 👋', '학교 지원과 전공 선택을 무료로 상담해 드립니다', '전문 상담원과 상담해 보세요'],
    ru: ['Есть вопросы? Напишите нам 👋', 'Бесплатная консультация по поступлению и специальностям', 'Получите консультацию специалиста'],
  },
  primaryColor: '#165DFF',
  contactWhatsApp: '',
  contactWecomQrUrl: '',
  formConfig: {
    presetFields: {
      name:          { enabled: true,  required: true },
      phone:         { enabled: true,  required: true },
      applyingLevel: { enabled: true,  required: false },
      email:         { enabled: false, required: false },
      wechat:        { enabled: false, required: false },
      education:     { enabled: false, required: false },
      targetMajor:   { enabled: false, required: false },
      budget:        { enabled: false, required: false },
    },
    customFields: [] as Array<{
      id: string
      label: string | Record<string, string>
      placeholder?: string | Record<string, string>
      type: 'text' | 'tel' | 'email' | 'select' | 'textarea'
      options?: string[] | Record<string, string[]>
      required: boolean
    }>,
  },
}

const DEFAULT_FAQS: Array<{ id: string; language: SupportedLang; question: string; answer: string; priority: number }> = [
  { id: 'default-1', language: 'zh-CN', question: '学费大概多少？', answer: '请咨询具体项目，不同课程费用不同。', priority: 1 },
  { id: 'default-2', language: 'zh-CN', question: '申请条件是什么？', answer: '一般需要学历证明和语言成绩，具体视项目而定。', priority: 2 },
  { id: 'default-3', language: 'zh-CN', question: '有奖学金吗？', answer: '部分项目提供奖学金，欢迎留下联系方式获取详情。', priority: 3 },
]

const DEFAULT_FAQ_TRANSLATIONS: Record<SupportedLang, Array<{ id: string; language: SupportedLang; question: string; answer: string; priority: number }>> = {
  'zh-CN': DEFAULT_FAQS,
  en: [
    { id: 'default-1', language: 'en', question: 'How much is the tuition?', answer: 'Please ask about the specific programme, as fees vary by course.', priority: 1 },
    { id: 'default-2', language: 'en', question: 'What are the admission requirements?', answer: 'Academic documents and language scores are usually required. Requirements vary by programme.', priority: 2 },
    { id: 'default-3', language: 'en', question: 'Are scholarships available?', answer: 'Some programmes offer scholarships. Leave your contact details for more information.', priority: 3 },
  ],
  ko: [
    { id: 'default-1', language: 'ko', question: '학비는 얼마인가요?', answer: '과정에 따라 학비가 다르므로 희망 과정을 알려 주세요.', priority: 1 },
    { id: 'default-2', language: 'ko', question: '지원 조건은 무엇인가요?', answer: '일반적으로 학력 증명서와 어학 성적이 필요하며 과정에 따라 달라집니다.', priority: 2 },
    { id: 'default-3', language: 'ko', question: '장학금이 있나요?', answer: '일부 과정은 장학금을 제공합니다. 자세한 내용은 연락처를 남겨 주세요.', priority: 3 },
  ],
  ru: [
    { id: 'default-1', language: 'ru', question: 'Сколько стоит обучение?', answer: 'Стоимость зависит от конкретной программы. Уточните интересующий курс.', priority: 1 },
    { id: 'default-2', language: 'ru', question: 'Каковы требования для поступления?', answer: 'Обычно нужны документы об образовании и языковой сертификат. Требования зависят от программы.', priority: 2 },
    { id: 'default-3', language: 'ru', question: 'Есть ли стипендии?', answer: 'Некоторые программы предлагают стипендии. Оставьте контакты, чтобы узнать подробности.', priority: 3 },
  ],
}
const DEFAULT_SITE_API_KEY = 'demo-api-key-001'

type FaqLookupClient = Pick<typeof prisma, 'faq' | 'site'>

function isFaqLookupClient(value: unknown): value is FaqLookupClient {
  return !!value && typeof value === 'object' && 'faq' in value && 'site' in value
}

/**
 * FAQ 读取顺序：当前站点语言 -> 当前站点中文 -> 默认站点语言 -> 默认站点中文 -> 代码兜底。
 * 第二、三个参数兼容旧调用：getFaqPool(siteId, take, client)。
 */
export function getFaqPool(siteId: string, lang: SupportedLang, take?: number, client?: FaqLookupClient): Promise<any[]>
export function getFaqPool(siteId: string, take?: number, client?: FaqLookupClient): Promise<any[]>
export async function getFaqPool(
  siteId: string,
  langOrTake: SupportedLang | number = 'zh-CN',
  takeOrClient?: number | FaqLookupClient,
  maybeClient?: FaqLookupClient,
) {
  let lang: SupportedLang = 'zh-CN'
  let take: number | undefined
  let client: FaqLookupClient = prisma

  if (typeof langOrTake === 'number') {
    take = langOrTake
    if (isFaqLookupClient(takeOrClient)) client = takeOrClient
  } else {
    lang = normalizeLang(langOrTake)
    if (typeof takeOrClient === 'number') take = takeOrClient
    if (isFaqLookupClient(takeOrClient)) client = takeOrClient
    if (isFaqLookupClient(maybeClient)) client = maybeClient
  }

  const findByLanguage = async (targetSiteId: string, targetLang: SupportedLang) => client.faq.findMany({
    where: { siteId: targetSiteId, language: targetLang },
    orderBy: { priority: 'asc' },
    ...(take === undefined ? {} : { take }),
  })

  const findWithFallback = async (targetSiteId: string) => {
    const localized = await findByLanguage(targetSiteId, lang)
    if (localized.length > 0 || lang === 'zh-CN') return localized
    return findByLanguage(targetSiteId, 'zh-CN')
  }

  const siteFaqs = await findWithFallback(siteId)
  if (siteFaqs.length > 0) return siteFaqs

  const defaultSite = await client.site.findUnique({
    where: { apiKey: DEFAULT_SITE_API_KEY },
    select: { id: true },
  })
  if (defaultSite && defaultSite.id !== siteId) {
    const defaultSiteFaqs = await findWithFallback(defaultSite.id)
    if (defaultSiteFaqs.length > 0) return defaultSiteFaqs
  }

  return take === undefined ? DEFAULT_FAQ_TRANSLATIONS[lang] : DEFAULT_FAQ_TRANSLATIONS[lang].slice(0, take)
}
async function createSession(
  siteId: string,
  visitorId: string,
  metadata?: any,
  siteKey?: string,
  origin?: string,
) {
  let site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { id: true, domain: true, apiKey: true, settings: true },
  })

  // 站点标识错误时拒绝创建隐式站点，避免聊天落到没有配置的站点。
  if (!site || (siteKey && site.apiKey !== siteKey)) return null

  // data-site-id can be copied between websites. When the browser Origin maps
  // to another configured site, route the new session to that site instead.
  // An explicit site key remains authoritative and must not be silently moved.
  const originHost = normalizeSiteOrigin(origin)
  if (originHost && !siteKey && site.domain !== originHost) {
    const originSite = await prisma.site.findUnique({
      where: { domain: originHost },
      select: { id: true, domain: true, apiKey: true, settings: true },
    })
    if (originSite) site = originSite
  }

  const settings = getPublicSiteSettings(site.settings)
  const session = await prisma.conversation.create({
    data: {
      siteId: site.id,
      visitorId,
      metadata: metadata || {},
    },
  })
  return { ...session, siteSettings: settings }
}
function isLocalizedObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function cleanLocalizedLists(value: Record<string, unknown>): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  for (const lang of SUPPORTED_LANGS) {
    const list = value[lang]
    if (Array.isArray(list)) {
      result[lang] = list.filter(item => typeof item === 'string' && item.trim()).map(item => item.trim())
    }
  }
  return result
}

function cleanLocalizedText(value: unknown): Record<string, string> {
  const result: Record<string, string> = {}
  if (typeof value === 'string' && value.trim()) {
    result['zh-CN'] = value.trim()
    return result
  }
  if (!isLocalizedObject(value)) return result
  for (const lang of SUPPORTED_LANGS) {
    const text = value[lang]
    if (typeof text === 'string' && text.trim()) result[lang] = text.trim()
  }
  return result
}

function normalizeLocalizedText(value: unknown, fallback: Record<string, string>): Record<string, string> {
  const result = cleanLocalizedText(value)
  return Object.keys(result).length > 0
    ? result
    : JSON.parse(JSON.stringify(fallback))
}

function mergeSettings(raw: any): Record<string, any> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return JSON.parse(JSON.stringify(DEFAULT_SITE_SETTINGS))
  const merged = { ...DEFAULT_SITE_SETTINGS, ...raw }

  merged.welcomeMessage = normalizeLocalizedText(merged.welcomeMessage, DEFAULT_SITE_SETTINGS.welcomeMessage)
  merged.guideMessage = normalizeLocalizedText(merged.guideMessage, DEFAULT_SITE_SETTINGS.guideMessage)

  // 兼容旧版单个 bubbleMessage 字符串：转成旧数组格式。
  if (
    merged.bubbleMessages === undefined &&
    typeof merged.bubbleMessage === 'string' &&
    merged.bubbleMessage.trim()
  ) {
    merged.bubbleMessages = [merged.bubbleMessage.trim()]
  }
  if (Array.isArray(merged.bubbleMessages)) {
    merged.bubbleMessages = {
      'zh-CN': merged.bubbleMessages
        .filter((item: unknown) => typeof item === 'string' && item.trim())
        .map((item: string) => item.trim()),
    }
  } else if (isLocalizedObject(merged.bubbleMessages)) {
    merged.bubbleMessages = cleanLocalizedLists(merged.bubbleMessages)
  } else {
    merged.bubbleMessages = JSON.parse(JSON.stringify(DEFAULT_SITE_SETTINGS.bubbleMessages))
  }
  if (Array.isArray(merged.bubbleMessages) && merged.bubbleMessages.length === 0) {
    merged.bubbleMessages = JSON.parse(JSON.stringify(DEFAULT_SITE_SETTINGS.bubbleMessages))
  }
  if (isLocalizedObject(merged.bubbleMessages) && Object.keys(merged.bubbleMessages).length === 0) {
    merged.bubbleMessages = JSON.parse(JSON.stringify(DEFAULT_SITE_SETTINGS.bubbleMessages))
  }
  delete merged.bubbleMessage

  // 兜底 formConfig，并保留站点已经配置的自定义字段。
  if (!merged.formConfig || typeof merged.formConfig !== 'object' || Array.isArray(merged.formConfig)) {
    merged.formConfig = JSON.parse(JSON.stringify(DEFAULT_SITE_SETTINGS.formConfig))
  } else {
    const fc = merged.formConfig
    if (!fc.presetFields || typeof fc.presetFields !== 'object' || Array.isArray(fc.presetFields)) {
      fc.presetFields = JSON.parse(JSON.stringify(DEFAULT_SITE_SETTINGS.formConfig.presetFields))
    } else {
      const defaults = DEFAULT_SITE_SETTINGS.formConfig.presetFields as Record<string, any>
      for (const key of Object.keys(defaults)) {
        if (!fc.presetFields[key]) fc.presetFields[key] = { ...defaults[key] }
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
  // 并发消息写入时，只允许更新为更晚的消息时间，避免旧请求覆盖新时间。
  await prisma.conversation.updateMany({
    where: {
      id: conversationId,
      OR: [
        { lastMessageAt: null },
        { lastMessageAt: { lt: msg.createdAt } },
      ],
    },
    data: { lastMessageAt: msg.createdAt },
  })
  return msg
}

// ---- Dify 对接 ----

const DIFY_TIMEOUT_MS = 15_000

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

async function askDify(conversationId: string, query: string, questionType?: string, lang: SupportedLang = 'zh-CN'): Promise<string> {
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
    return getAiFallbackReply(lang, 'unconfigured')
  }
  try {
    url = normalizeDifyApiUrl(url)
  } catch {
    console.error('[chat-api] Dify API 地址无效，请填写 API 域名或 /v1/chat-messages 接口地址')
    return getAiFallbackReply(lang, 'unavailable')
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
      return getAiFallbackReply(lang, 'unavailable')
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
    let answer = stream.answer || getAiFallbackReply(lang, 'noAnswer')
    // 过滤推理模型的 <think>...</think> 标签
    answer = answer.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
    return answer
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.error('[chat-api] Dify 请求超时')
      return getAiFallbackReply(lang, 'timeout')
    }
    console.error('[chat-api] Dify 请求失败:', err.message)
    return getAiFallbackReply(lang, 'unavailable')
  } finally {
    clearTimeout(timer)
  }
}

// ---- 转人工 ----

const TRANSFER_REPLIES: Record<string, string> = {
  'zh-CN': '已将您的需求转给专业顾问，稍后会联系您。',
  'en': 'Your request has been forwarded to a consultant. We will contact you shortly.',
    'ko': '요청을 전문 상담원에게 전달했습니다. 곧 연락드리겠습니다.',
}

export function getTransferReply(lang: string): string {
  return TRANSFER_REPLIES[lang] || TRANSFER_REPLIES['zh-CN']
}

async function transferToHuman(conversationId: string) {
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { status: 'transferred' },
  })
}

// ---- 预设问题 ----

async function getFaqs(siteId: string, lang: SupportedLang = 'zh-CN') {
  return getFaqPool(siteId, lang, 10)
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
  lang: SupportedLang = 'zh-CN',
): Promise<string[]> {
  const pool = await getFaqPool(siteId, lang, 20)

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
  return conv?.status === 'taken_over' || conv?.status === 'transferred'
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
    select: { status: true },
  })
  if (conv?.status === 'taken_over') {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { status: 'active' },
    })
  }
}

/** 根据 apiKey 查找站点 */
async function findSiteByApiKey(apiKey: string) {
  return prisma.site.findUnique({ where: { apiKey } })
}

/** 根据用户消息匹配 FAQ 预设答案，无匹配返回 null */
async function findFaqAnswer(siteId: string, content: string, lang: SupportedLang = 'zh-CN'): Promise<string | null> {
  const pool = await getFaqPool(siteId, lang)

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
  getTransferReply,
  transferToHuman,
  getFaqs,
  getSuggestedQuestions,
  findFaqAnswer,
  findSiteByApiKey,
  getConversationSiteId,
  getSiteSettings,
  isTakenOver,
  isNoAnswerReply,
  updateNoAnswerCount,
  takeOver,
  releaseTakeOver,
}
