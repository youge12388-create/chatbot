/**
 * Chat API 路由定义
 *
 * 对外暴露给 widget.js 的接口
 */

import { Router, Request, Response, NextFunction } from 'express'
import { chatService } from '../services/chat'
import { leadService } from '../services/lead'
import { publish, publishAdmin } from '../services/pubsub'

const router = Router()

// ---- 工具函数 ----

type AsyncHandler = (req: Request, res: Response) => Promise<void>

/** 包装异步 handler，统一捕获异常 */
function wrap(fn: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next)
  }
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
router.post('/session', wrap(async (req, res) => {
  const err = requireFields(req.body, ['siteId', 'visitorId'])
  if (err) {
    res.status(400).json({ code: 1, message: err })
    return
  }
  const { siteId, visitorId, metadata } = req.body
  const session = await chatService.createSession(siteId, visitorId, metadata)
  res.json({ code: 0, data: session })
}))

// ========================
// 消息发送
// ========================

/** POST /api/chat/message - 发送消息，返回 AI 回复 */
router.post('/message', wrap(async (req, res) => {
  const err = requireFields(req.body, ['conversationId', 'content'])
  if (err) {
    res.status(400).json({ code: 1, message: err })
    return
  }
  const { conversationId, content, lang } = req.body

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
  const faqAnswer = await chatService.findFaqAnswer(siteId, content)
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
        reply = await chatService.askDify(conversationId, content, 'faq')
        source = 'ai'
        break

      case 'knowledge':
        reply = await chatService.askDify(conversationId, content, 'knowledge')
        source = 'ai'
        needForm = await chatService.shouldShowForm(conversationId)
        break

      case 'personalized':
        reply = await chatService.askDify(conversationId, content, 'personalized')
        source = 'ai'
        needForm = true
        break

      case 'transfer':
        reply = chatService.getTransferReply(lang || 'zh-CN')
        source = 'human'
        needForm = true
        await chatService.transferToHuman(conversationId)
        // 转人工自动推通知（不阻塞响应）
        leadService.notifyTransfer(conversationId).catch(() => {})
        break

      default:
        reply = await chatService.askDify(conversationId, content)
        source = 'ai'
    }
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
router.post('/lead', wrap(async (req, res) => {
  const err = requireFields(req.body, ['conversationId'])
  if (err) {
    res.status(400).json({ code: 1, message: err })
    return
  }
  const { conversationId, ...fields } = req.body
  const lead = await leadService.upsertLead(conversationId, fields)
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
  const { siteId } = req.query
  if (!siteId) {
    res.status(400).json({ code: 1, message: '缺少必填参数: siteId' })
    return
  }
  const faqs = await chatService.getFaqs(siteId as string)
  res.json({ code: 0, data: faqs })
}))

/** GET /api/chat/leads - 查看所有线索 */
router.get('/leads', wrap(async (_req, res) => {
  const { prisma } = require('../db/client')
  const leads = await prisma.lead.findMany({
    include: {
      conversation: {
        select: { interestLevel: true, status: true, createdAt: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  res.json({ code: 0, data: leads })
}))

/** GET /api/chat/leads/html - 网页查看线索（方便手机直接看） */
router.get('/leads/html', wrap(async (_req, res) => {
  const { prisma } = require('../db/client')
  const leads = await prisma.lead.findMany({
    include: {
      conversation: {
        select: { interestLevel: true, status: true, createdAt: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  const interestLabel: Record<string, string> = {
    unknown: '未知', low: '低', normal: '一般',
    medium: '中等', high: '高', strong: '极高',
  }

  const rows = leads.map((l: any) => `
    <tr>
      <td>${l.name || '-'}</td>
      <td>${l.phone || '-'}</td>
      <td>${l.email || '-'}</td>
      <td>${interestLabel[l.conversation?.interestLevel] || '未知'}</td>
      <td>${new Date(l.createdAt).toLocaleString('zh-CN')}</td>
    </tr>
  `).join('')

  res.type('html').send(`
    <!DOCTYPE html><html><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>线索列表</title>
    <style>
      body { font-family: -apple-system, sans-serif; margin: 20px; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
      th { background: #f5f5f5; }
      h1 { font-size: 20px; }
    </style></head><body>
    <h1>线索列表（共 ${leads.length} 条）</h1>
    <table>
      <tr><th>姓名</th><th>电话</th><th>邮箱</th><th>兴趣等级</th><th>提交时间</th></tr>
      ${rows || '<tr><td colspan="5">暂无线索</td></tr>'}
    </table>
    </body></html>
  `)
}))

/** GET /api/chat/leads/test-notify - 测试企微通知（方便排查） */
router.get('/leads/test-notify', wrap(async (_req, res) => {
  const url = process.env.WECOM_WEBHOOK_URL
  const n8nUrl = process.env.N8N_WEBHOOK_URL

  if (!url && !n8nUrl) {
    res.json({ code: 1, message: 'WECOM_WEBHOOK_URL 和 N8N_WEBHOOK_URL 都未配置' })
    return
  }

  const targets: string[] = []
  if (n8nUrl) targets.push('n8n')
  if (url) targets.push('企微')

  // 尝试直连企微
  if (url) {
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          msgtype: 'text',
          text: { content: '✅ chatbot 通知测试：如果你收到这条消息，说明企微推送配置正确。' },
        }),
      })
      const body = await resp.text()
      res.json({
        code: 0,
        message: `已向 ${targets.join(' 和 ')} 发送测试消息`,
        wecom: { status: resp.status, body },
      })
      return
    } catch (err: any) {
      res.json({ code: 1, message: `企微通知失败: ${err.message}`, url_prefix: url.substring(0, 30) })
      return
    }
  }

  res.json({ code: 0, message: '仅配置了 n8n，跳过企微测试' })
}))

// ========================
// SSE 实时推送 + 历史消息
// ========================

/** GET /api/chat/stream?conversationId=xxx - widget 建立 SSE 长连接，接收后台人工回复 */
router.get('/stream', (req, res) => {
  const { conversationId } = req.query
  if (!conversationId) {
    res.status(400).json({ code: 1, message: '缺少必填参数: conversationId' })
    return
  }

  // widget SSE 无需认证（访客建立连接），后台通过 pubsub 推送

  // SSE 头
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // 关闭 Nginx/网关缓冲
  })
  res.write('\n')

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
  })
})

/** GET /api/chat/messages?conversationId=xxx&after=ISO时间 - 拉取历史消息（widget 重连时拉未读） */
router.get('/messages', wrap(async (req, res) => {
  const { conversationId, after } = req.query
  if (!conversationId) {
    res.status(400).json({ code: 1, message: '缺少必填参数: conversationId' })
    return
  }

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