/**
 * Chat API 路由定义
 *
 * 对外暴露给 widget.js 的接口
 */

import { Router, Request, Response, NextFunction } from 'express'
import { chatService, normalizeLang } from '../services/chat'
import { leadService, normalizeLeadInput } from '../services/lead'
import { publish, publishAdmin } from '../services/pubsub'
import { validateConversationSession } from '../services/session-auth'
import { chatRateLimiters, refreshConnection, releaseConnection, tryAcquireConnection } from '../middleware/rate-limit'

const router = Router()

// ---- 工具函数 ----

type AsyncHandler = (req: Request, res: Response) => Promise<void>

/** 包装异步 handler，统一捕获异常 */
function wrap(fn: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next)
  }
}

async function requireConversationSession(
  req: Request,
  res: Response,
  conversationId: unknown,
): Promise<boolean> {
  const token = req.get('x-chat-session-token')?.trim() || ''
  const valid = typeof conversationId === 'string'
    && await validateConversationSession(conversationId, token)

  if (!valid) {
    res.status(401).json({ code: 1, message: '会话令牌无效或已过期' })
    return false
  }
  return true
}
// ---- 校验 ----

function requireFields(body: Record<string, any>, fields: string[]): string | null {
  for (const f of fields) {
    if (!body[f] || !String(body[f]).trim()) {
      return `缺少必填字段: ${f}`
    }
  }
  return null
}

// ========================
// 会话管理
// ========================

/** POST /api/chat/session - 创建会话 */
router.post('/session', chatRateLimiters.session, wrap(async (req, res) => {
  const err = requireFields(req.body, ['siteId', 'visitorId'])
  if (err) {
    res.status(400).json({ code: 1, message: err })
    return
  }
  const { siteId, visitorId, siteKey, metadata } = req.body
  const session = await chatService.createSession(siteId, visitorId, metadata, siteKey)
  if (!session) {
    res.status(404).json({ code: 1, message: '站点不存在或站点标识不匹配' })
    return
  }
  res.json({ code: 0, data: session })
}))

// ========================
// 消息发送
// ========================

/** POST /api/chat/message - 发送消息，返回 AI 回复 */
router.post('/message', chatRateLimiters.message, wrap(async (req, res) => {
  const err = requireFields(req.body, ['conversationId', 'content'])
  if (err) {
    res.status(400).json({ code: 1, message: err })
    return
  }
  const { conversationId, content, lang } = req.body
  if (!await requireConversationSession(req, res, conversationId)) return
  const requestLang = normalizeLang(lang)

  // 1. 保存用户消息
  const userMsg = await chatService.saveMessage(conversationId, 'user', content, 'user')
  const siteId = await chatService.getConversationSiteId(conversationId)

  // 1.1 推到后台 admin 通道（后台实时显示客户消息）
  publishAdmin({
    event: 'user_message',
    data: {
      id: userMsg.id,
      conversationId,
      siteId,
      role: 'user',
      content,
      source: 'user',
      createdAt: userMsg.createdAt,
    },
  })

  // 2. 若已被人工接管，不调 AI，只返回提示
  const takenOver = await chatService.isTakenOver(conversationId)
  if (takenOver) {
    res.json({
      code: 0,
      data: { reply: '', source: 'human', needForm: false, takenOver: true },
    })
    return
  }

  // 3. 优先匹配 FAQ 预设答案（用户点 FAQ 按钮时文本与 FAQ 问题一致，直接返回预设）
  const faqAnswer = await chatService.findFaqAnswer(siteId, content, requestLang)
  const category = chatService.classifyQuestion(content)

  let reply: string
  let source: 'preset' | 'ai' | 'human'
  let needForm: boolean = false

  if (faqAnswer) {
    reply = faqAnswer
    source = 'preset'
  } else {
    switch (category.type) {
      case 'faq':
        // FAQ 关键词匹配但无对应预设答案，降级走 Dify
        reply = await chatService.askDify(conversationId, content, 'faq', requestLang)
        source = 'ai'
        break

      case 'knowledge':
        reply = await chatService.askDify(conversationId, content, 'knowledge', requestLang)
        source = 'ai'
        needForm = await chatService.shouldShowForm(conversationId)
        break

      case 'personalized':
        reply = await chatService.askDify(conversationId, content, 'personalized', requestLang)
        source = 'ai'
        needForm = true
        break

      case 'transfer':
        reply = chatService.getTransferReply(requestLang)
        source = 'human'
        needForm = true
        await chatService.transferToHuman(conversationId)
        // 转人工自动推通知（不阻塞响应）
        break

      default:
        reply = await chatService.askDify(conversationId, content, undefined, requestLang)
        source = 'ai'
    }
  }

  // AI 连续两次无法回答时自动转人工
  const noAnswerCount = await chatService.updateNoAnswerCount(
    conversationId,
    source === 'ai' && chatService.isNoAnswerReply(reply),
  )
  if (source === 'ai' && noAnswerCount >= 2) {
    reply = chatService.getTransferReply(requestLang)
    source = 'human'
    needForm = true
    await chatService.transferToHuman(conversationId)
  }
  // 4. 保存 AI 回复
  await chatService.saveMessage(conversationId, 'assistant', reply, source)

  // 5. 更新兴趣评分（不阻塞响应）
  leadService.updateInterestScore(conversationId, content, category.type).catch(() => {})

  // 6. 获取动态推荐问题（基于用户当前问题 + 排除已问过的）
  const { prisma } = require('../db/client')
  const askedMsgs = await prisma.message.findMany({
    where: { conversationId, role: 'user' },
    select: { content: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })
  const askedQuestions = askedMsgs.map((m: any) => m.content)
  const suggestedQuestions = await chatService.getSuggestedQuestions(
    siteId,
    content,
    askedQuestions,
    requestLang,
  )

  res.json({
    code: 0,
    data: { reply, source, needForm, suggestedQuestions },
  })
}))

// ========================
// 线索提交
// ========================

/** POST /api/chat/lead - 提交/更新线索 */
router.post('/lead', chatRateLimiters.lead, wrap(async (req, res) => {
  const err = requireFields(req.body, ['conversationId'])
  if (err) {
    res.status(400).json({ code: 1, message: err })
    return
  }
  const { conversationId, ...fields } = req.body
  if (!await requireConversationSession(req, res, conversationId)) return
  let normalized
  try {
    normalized = normalizeLeadInput(fields)
  } catch (error) {
    res.status(400).json({
      code: 1,
      message: error instanceof Error ? error.message : '线索字段无效',
    })
    return
  }
  const lead = await leadService.upsertLead(String(conversationId), normalized.fields, normalized.extra)
  res.json({ code: 0, data: lead })
}))

// ========================
// 预设问题
// ========================

/** GET /api/chat/site?siteKey=xxx - 根据 apiKey 获取站点配置 */
router.get('/site', wrap(async (req, res) => {
  const { siteKey } = req.query
  if (!siteKey) {
    res.status(400).json({ code: 1, message: '缺少必填参数: siteKey' })
    return
  }
  const site = await chatService.findSiteByApiKey(siteKey as string)
  if (!site) {
    res.status(404).json({ code: 1, message: '站点不存在' })
    return
  }
  const settings = await chatService.getSiteSettings(site.id)
  res.json({ code: 0, data: settings })
}))

/** GET /api/chat/faqs?siteId=xxx - 获取站点预设问题 */
router.get('/faqs', wrap(async (req, res) => {
  const { siteId, lang } = req.query
  if (!siteId) {
    res.status(400).json({ code: 1, message: '缺少必填参数: siteId' })
    return
  }
  const faqs = await chatService.getFaqs(siteId as string, normalizeLang(lang))
  res.json({ code: 0, data: faqs })
}))

// SSE 实时推送 + 历史消息
// ========================

/** GET /api/chat/stream?conversationId=xxx - widget 建立 SSE 长连接，接收后台人工回复 */
router.get('/stream', chatRateLimiters.stream, wrap(async (req, res) => {
  const { conversationId } = req.query
  if (!conversationId) {
    res.status(400).json({ code: 1, message: '缺少必填参数: conversationId' })
    return
  }

  const token = typeof req.query.token === 'string' ? req.query.token : ''
  if (!await validateConversationSession(conversationId as string, token)) {
    res.status(401).json({ code: 1, message: '会话令牌无效或已过期' })
    return
  }
  const connectionKey = (req.ip || 'unknown') + ':' + String(conversationId)
  const connectionToken = await tryAcquireConnection(connectionKey, 5)
  if (!connectionToken) {
    res.status(429).json({ code: 1, message: '会话连接数过多，请稍后再试' })
    return
  }
  let connectionReleased = false
  const refreshTimer = setInterval(() => {
    void refreshConnection(connectionKey, connectionToken).catch((error) => {
      console.error('[chat-stream] failed to refresh Redis connection lease:', error)
    })
  }, 30_000)
  const release = () => {
    if (connectionReleased) return
    connectionReleased = true
    clearInterval(refreshTimer)
    void releaseConnection(connectionKey, connectionToken).catch((error) => {
      console.error('[chat-stream] failed to release Redis connection lease:', error)
    })
  }
  req.on('close', release)
  // widget SSE 无需认证（访客建立连接），后台通过 pubsub 推送

  // SSE 头
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-store, no-cache, no-transform',
    'Referrer-Policy': 'no-referrer',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // 关闭 Nginx/网关缓冲
  })
  res.write('\n\n')

  // 心跳保活（每 25 秒）
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n')
  }, 25_000)

  // 订阅该会话的推送
  const { subscribe } = require('../services/pubsub')
  const unsubscribe = subscribe(conversationId as string, (payload: any) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`)
  })

  // 客户端断开时清理
  req.on('close', () => {
    clearInterval(heartbeat)
    unsubscribe()
    release()
  })
}))

/** GET /api/chat/messages?conversationId=xxx&after=ISO时间 - 拉取历史消息（widget 重连时拉未读） */
router.get('/messages', wrap(async (req, res) => {
  const { conversationId, after } = req.query
  if (!conversationId) {
    res.status(400).json({ code: 1, message: '缺少必填参数: conversationId' })
    return
  }

  if (!await requireConversationSession(req, res, conversationId)) return

  const where: any = { conversationId: conversationId as string }
  if (after) {
    where.createdAt = { gt: new Date(after as string) }
  }

  const messages = await require('../db/client').prisma.message.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    take: 100,
  })

  res.json({ code: 0, data: messages })
}))

export default router
