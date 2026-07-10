/**
 * Chat API 路由定义
 *
 * 对外暴露给 widget.js 的接口
 */

import { Router, Request, Response, NextFunction } from 'express'
import { chatService } from '../services/chat'
import { leadService } from '../services/lead'

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
  await chatService.saveMessage(conversationId, 'user', content, 'user')

  // 2. 问题分类
  const category = chatService.classifyQuestion(content)

  let reply: string
  let source: 'preset' | 'ai' | 'human'
  let needForm: boolean = false

  switch (category.type) {
    case 'faq': {
      const siteId = await chatService.getConversationSiteId(conversationId)
      const faqAnswer = await chatService.findFaqAnswer(siteId, content)
      if (faqAnswer) {
        reply = faqAnswer
        source = 'preset'
      } else {
        // FAQ 关键词匹配但无对应预设答案，降级走 Dify
        reply = await chatService.askDify(conversationId, content)
        source = 'ai'
      }
      break
    }

    case 'knowledge':
      reply = await chatService.askDify(conversationId, content)
      source = 'ai'
      needForm = await chatService.shouldShowForm(conversationId)
      break

    case 'personalized':
      reply = await chatService.askDify(conversationId, content)
      source = 'ai'
      needForm = true
      break

    case 'transfer':
      reply = chatService.getTransferReply(lang || 'zh-CN')
      source = 'human'
      needForm = true
      await chatService.transferToHuman(conversationId)
      break

    default:
      reply = await chatService.askDify(conversationId, content)
      source = 'ai'
  }

  // 3. 保存 AI 回复
  await chatService.saveMessage(conversationId, 'assistant', reply, source)

  // 4. 更新兴趣评分（不阻塞响应）
  leadService.updateInterestScore(conversationId, content, category.type).catch(() => {})

  res.json({
    code: 0,
    data: { reply, source, needForm },
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

export default router