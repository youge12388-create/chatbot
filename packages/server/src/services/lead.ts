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

/**
 * 根据用户消息内容与问题类型更新兴趣评分
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

  // 消息长度加分（越长越认真）
  const lengthBonus = content.length > 20 ? 1 : 0

  const newScore = Math.min(currentScore + typeWeight + lengthBonus, 5)
  const newLevel = calcLevel(newScore)

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { interestLevel: newLevel },
  })
}

/**
 * 更新或创建线索
 */
async function upsertLead(conversationId: string, fields: Record<string, any>) {
  const { extra, ...rest } = fields
  const existing = await prisma.lead.findFirst({
    where: { conversationId },
  })

  let lead
  if (existing) {
    lead = await prisma.lead.update({
      where: { id: existing.id },
      data: {
        ...rest,
        extra: extra ? { ...(existing.extra as any), ...extra } : undefined,
      },
    })
  } else {
    lead = await prisma.lead.create({
      data: { conversationId, ...rest, extra: extra || {} },
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
 */
async function notifyNewLead(conversationId: string) {
  const lead = await prisma.lead.findFirst({
    where: { conversationId },
    include: {
      conversation: {
        include: { messages: { orderBy: { createdAt: 'asc' }, take: 20 } },
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

  // 优先走 n8n
  if (process.env.N8N_WEBHOOK_URL) {
    const ok = await postJson(process.env.N8N_WEBHOOK_URL, payload)
    if (ok) return
  }

  // 降级：直连企微机器人
  if (process.env.WECOM_WEBHOOK_URL) {
    const text = formatWecomText(payload.data)
    await postJson(process.env.WECOM_WEBHOOK_URL, {
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
async function postJson(url: string, body: any): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10_000)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!response.ok) {
      console.error(`[chat-api] 通知返回 ${response.status}: ${response.statusText}`)
      return false
    }
    return true
  } catch (err: any) {
    console.error('[chat-api] 通知发送失败:', err.message)
    return false
  } finally {
    clearTimeout(timer)
  }
}

export const leadService = {
  updateInterestScore,
  upsertLead,
  notifyNewLead,
}