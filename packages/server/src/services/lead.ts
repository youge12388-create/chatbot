/**
 * 线索管理服务
 *
 * 职责：
 * - 兴趣评分
 * - 线索信息收集
 * - 触发 n8n 通知
 */

import { prisma } from '../db/client'

// 兴趣等级权重
const INTEREST_SCORES: Record<string, number> = {
  unknown: 0,
  low: 1,
  normal: 2,
  medium: 3,
  high: 4,
  strong: 5,
}

function calcLevel(score: number): string {
  if (score >= 5) return 'strong'
  if (score >= 4) return 'high'
  if (score >= 3) return 'medium'
  if (score >= 2) return 'normal'
  if (score >= 1) return 'low'
  return 'unknown'
}

// 问题类型权重
const TYPE_WEIGHTS: Record<string, number> = {
  personalized: 2,   // 个性化咨询 = 强意向
  transfer: 3,       // 转人工 = 极强意向
  knowledge: 1,      // 知识库问题 = 一般意向
  faq: 0,            // 预设问题 = 不增加权重
}

// 高意向关键词（出现即加分）
const HIGH_INTENT_KEYWORDS = [
  '报名', '签约', '缴费', '付款', '马上', '急需', '尽快',
  '多少钱', '费用', '预算', '学费',
  '联系方式', '电话', '微信', '老师',
]

// 中意向关键词
const MEDIUM_INTENT_KEYWORDS = [
  '申请', '条件', '要求', '截止', 'deadline',
  '雅思', '托福', 'GPA', '成绩',
  '奖学金', '专业', '推荐',
]

/**
 * 根据用户消息内容与问题类型更新兴趣评分
 * 评分 = 问题类型权重 + 关键词加权 + 消息长度加分
 */
async function updateInterestScore(
  conversationId: string,
  content: string,
  questionType: string,
) {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { interestLevel: true },
  })
  if (!conv) return

  const currentScore = INTEREST_SCORES[conv.interestLevel] || 0
  const typeWeight = TYPE_WEIGHTS[questionType] || 0

  // 关键词加权
  let keywordBonus = 0
  for (const kw of HIGH_INTENT_KEYWORDS) {
    if (content.includes(kw)) {
      keywordBonus += 2
      break // 每类最多加一次
    }
  }
  if (keywordBonus === 0) {
    for (const kw of MEDIUM_INTENT_KEYWORDS) {
      if (content.includes(kw)) {
        keywordBonus += 1
        break
      }
    }
  }

  // 消息长度加分（越长越认真）
  const lengthBonus = content.length > 20 ? 1 : 0

  const newScore = Math.min(currentScore + typeWeight + keywordBonus + lengthBonus, 5)
  const newLevel = calcLevel(newScore)

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { interestLevel: newLevel },
  })
}

/**
 * 更新或创建线索
 */
const LEAD_FIELDS = new Set([
  'name',
  'phone',
  'email',
  'wechat',
  'education',
  'targetMajor',
  'budget',
  'enrollmentDate',
])

function normalizeLeadFields(fields: Record<string, any>) {
  const leadFields: Record<string, any> = {}
  const extra = fields.extra && typeof fields.extra === 'object' && !Array.isArray(fields.extra)
    ? { ...fields.extra }
    : {}

  for (const [key, value] of Object.entries(fields)) {
    if (key === 'extra') continue
    // Legacy form submissions use applyingLevel, which is stored as an extension field.
    if (key === 'applyingLevel') {
      extra.applyingLevel = value
    } else if (LEAD_FIELDS.has(key)) {
      leadFields[key] = value
    } else {
      extra[key] = value
    }
  }

  return { leadFields, extra }
}

async function upsertLead(conversationId: string, fields: Record<string, any>) {
  const { leadFields, extra } = normalizeLeadFields(fields)
  const existing = await prisma.lead.findFirst({
    where: { conversationId },
  })

  let lead
  if (existing) {
    lead = await prisma.lead.update({
      where: { id: existing.id },
      data: {
        ...leadFields,
        extra: Object.keys(extra).length > 0 ? { ...(existing.extra as any), ...extra } : undefined,
      },
    })
  } else {
    lead = await prisma.lead.create({
      data: { conversationId, ...leadFields, extra },
    })
  }

  // 线索有手机就推通知
  if (fields.phone) {
    await notifyNewLead(conversationId)
  }

  return lead
}

/**
 * 通知新线索：优先 n8n，降级到企微直连
 * webhook 地址优先从 site.settings.webhookUrl 读，兼容环境变量
 */
async function notifyNewLead(conversationId: string) {
  const lead = await prisma.lead.findFirst({
    where: { conversationId },
    include: {
      conversation: {
        include: {
          messages: { orderBy: { createdAt: 'asc' }, take: 20 },
          site: { select: { settings: true } },
        },
      },
    },
  })
  if (!lead) return

  const payload = {
    event: 'new_lead',
    data: {
      id: lead.id,
      conversationId: lead.conversationId,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      interestLevel: lead.conversation.interestLevel,
      messages: lead.conversation.messages.map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
    },
  }

  // webhook 地址：站点配置优先，环境变量兜底
  const siteSettings = (lead.conversation.site?.settings as any) || {}
  const n8nUrl = siteSettings.n8nWebhookUrl || process.env.N8N_WEBHOOK_URL
  const wecomUrl = siteSettings.webhookUrl || process.env.WECOM_WEBHOOK_URL

  // 优先走 n8n
  if (n8nUrl) {
    const result = await postJson(n8nUrl, payload)
    if (result.ok) return
  }

  // 降级：直连企微机器人
  if (wecomUrl) {
    const text = formatWecomText(payload.data)
    await postJson(wecomUrl, {
      msgtype: 'text',
      text: { content: text },
    })
  }
}

/** 格式化企微消息文案 */
function formatWecomText(data: any): string {
  const interestLabel: Record<string, string> = {
    unknown: '未知', low: '低', normal: '一般',
    medium: '中等', high: '高', strong: '极高',
  }
  const chatHistory = (data.messages || [])
    .slice(-6)
    .map((m: any) => `${m.role === 'user' ? '用户' : 'AI'}：${m.content}`)
    .join('\n')

  return [
    '🔔 新线索通知',
    '',
    `姓名：${data.name || '未填写'}`,
    `电话：${data.phone || '未填写'}`,
    `邮箱：${data.email || '未填写'}`,
    `兴趣等级：${interestLabel[data.interestLevel] || '未知'}`,
    '',
    '--- 最近对话 ---',
    chatHistory || '（无对话记录）',
  ].join('\n')
}

/** POST JSON，吞异常，返回是否成功 */
export interface WebhookResult {
  ok: boolean
  status: number
  message: string
}

export async function postJson(url: string, body: any): Promise<WebhookResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10_000)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const responseBody = await response.text().catch(() => '')

    if (!response.ok) {
      console.error(`[chat-api] 通知返回 ${response.status}: ${response.statusText}`)
      return { ok: false, status: response.status, message: responseBody || response.statusText }
    }

    try {
      const result = JSON.parse(responseBody) as { errcode?: number; errmsg?: string }
      if (typeof result.errcode === 'number' && result.errcode !== 0) {
        return { ok: false, status: response.status, message: result.errmsg || `errcode=${result.errcode}` }
      }
    } catch {
      // n8n 等 Webhook 可能返回纯文本，HTTP 2xx 即视为成功。
    }

    return { ok: true, status: response.status, message: 'ok' }
  } catch (err: any) {
    console.error('[chat-api] 通知发送失败:', err.message)
    return { ok: false, status: 0, message: err.message || 'network error' }
  } finally {
    clearTimeout(timer)
  }
}
/**
 * 转人工通知：即使用户未留资，也推送一条通知
 * webhook 地址优先从 site.settings.webhookUrl 读，兼容环境变量
 */
async function notifyTransfer(conversationId: string): Promise<boolean> {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: { orderBy: { createdAt: 'asc' }, take: 20 },
      leads: true,
      site: { select: { name: true, domain: true, settings: true } },
    },
  })
  if (!conv) return false

  const lead = conv.leads[0]
  const interestLabel: Record<string, string> = {
    unknown: '未知', low: '低', normal: '一般',
    medium: '中等', high: '高', strong: '极高',
  }
  const payload = {
    event: 'transfer_request',
    data: {
      conversationId,
      siteName: conv.site?.name || '未命名站点',
      siteDomain: conv.site?.domain || '',
      name: lead?.name || '未填写',
      phone: lead?.phone || '未填写',
      interestLevel: conv.interestLevel,
      messages: conv.messages.map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
    },
  }

  const siteSettings = (conv.site?.settings as any) || {}
  const wecomUrl = siteSettings.webhookUrl || process.env.WECOM_WEBHOOK_URL
  if (!wecomUrl) {
    console.error('[chat-api] 企业微信通知未配置 Webhook')
    return false
  }

  const chatHistory = payload.data.messages
    .slice(-6)
    .map((m: { role: string; content: string }) => `${m.role === 'user' ? '客户' : 'AI'}：${m.content}`)
    .join('\n')
  const text = [
    '🔴 转人工请求',
    `站点：${payload.data.siteName}${payload.data.siteDomain ? `（${payload.data.siteDomain}）` : ''}`,
    `会话：${conversationId}`,
    '',
    `姓名：${payload.data.name}`,
    `电话：${payload.data.phone}`,
    `兴趣等级：${interestLabel[payload.data.interestLevel] || '未知'}`,
    '',
    '--- 最近对话 ---',
    chatHistory || '（无对话记录）',
  ].join('\n')

  const result = await postJson(wecomUrl, {
    msgtype: 'text',
    text: { content: text },
  })
  if (!result.ok) console.error(`[chat-api] 企业微信转人工通知失败: ${result.message}`)
  return result.ok
}

export async function sendWecomTest(webhookUrl: string): Promise<WebhookResult> {
  return postJson(webhookUrl, {
    msgtype: 'text',
    text: { content: '✅ Chatbot 企业微信机器人连接测试成功' },
  })
}
export const leadService = {
  updateInterestScore,
  upsertLead,
  notifyNewLead,
  notifyTransfer,
}