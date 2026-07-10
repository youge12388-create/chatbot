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

async function createSession(siteId: string, visitorId: string, metadata?: any) {
  const session = await prisma.conversation.create({
    data: {
      siteId,
      visitorId,
      metadata: metadata || {},
    },
  })
  return session
}

async function saveMessage(
  conversationId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  source: string,
) {
  return prisma.message.create({
    data: { conversationId, role, content, source },
  })
}

// ---- Dify 对接 ----

const DIFY_TIMEOUT_MS = 15_000

async function askDify(conversationId: string, query: string): Promise<string> {
  const url = process.env.DIFY_API_URL
  const key = process.env.DIFY_API_KEY

  if (!url || !key) {
    console.warn('[chat-api] Dify 未配置，返回兜底回复')
    return '抱歉，AI 服务暂未配置，请联系管理员。'
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DIFY_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: {},
        query,
        conversation_id: conversationId,
        user: conversationId,
        response_mode: 'blocking',
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      console.error(`[chat-api] Dify 返回 ${response.status}: ${response.statusText}`)
      return '抱歉，AI 服务暂时不可用，请稍后重试。'
    }

    const data = await response.json() as any
    return data.answer || '抱歉，我暂时无法回答这个问题，请稍后重试。'
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
    data: { status: 'transferred' },
  })
  // TODO: 触发 n8n webhook 通知企微/飞书
}

// ---- 预设问题 ----

async function getFaqs(siteId: string) {
  return prisma.faq.findMany({
    where: { siteId },
    orderBy: { priority: 'asc' },
    take: 10,
  })
}

/** 获取会话所属站点 ID */
async function getConversationSiteId(conversationId: string): Promise<string> {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { siteId: true },
  })
  return conv?.siteId || ''
}

/** 根据用户消息匹配 FAQ 预设答案，无匹配返回 null */
async function findFaqAnswer(siteId: string, content: string): Promise<string | null> {
  const faqs = await prisma.faq.findMany({
    where: { siteId },
    orderBy: { priority: 'asc' },
  })

  for (const faq of faqs) {
    // 双向匹配：用户问题包含 FAQ 问题，或 FAQ 问题包含用户问题
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
  findFaqAnswer,
  getConversationSiteId,
}