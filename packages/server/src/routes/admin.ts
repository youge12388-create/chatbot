/**
 * 后台管理 API 路由
 *
 * 全部需 JWT（除 /login），挂在 /api/admin/*
 *
 * 模块：
 * - 认证：login / me
 * - 线索：list / detail / update / export
 * - 会话：list / detail / reply / takeover / release
 * - 站点：list / update
 * - FAQ：list / create / update / delete
 * - 账号：list / create / update / delete（仅 admin）
 */

import { Router, Request, Response, NextFunction } from 'express'
import { randomBytes } from 'node:crypto'
import { prisma } from '../db/client'
import { chatService, getDifyInfoUrl } from '../services/chat'
import { sendWecomTest } from '../services/lead'
import { authService } from '../services/auth'
import { requireAuth, requireAdmin } from '../middleware/auth'
import { adminLoginRateLimiter } from '../middleware/rate-limit'
import { publish, publishAdmin, subscribeAdmin } from '../services/pubsub'
import { normalizeSiteDomain } from '../utils/site-domain'

const router = Router()

// ---- 工具 ----

type AsyncHandler = (req: Request, res: Response) => Promise<void>
function wrap(fn: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next)
  }
}

function generateSiteApiKey(): string {
  return `site-${randomBytes(24).toString('hex')}`
}

// ========================
// 认证
// ========================

/** POST /api/admin/login */
router.post('/login', adminLoginRateLimiter, wrap(async (req, res) => {
  const { username, password } = req.body
  if (!username || !password) {
    res.status(400).json({ code: 1, message: '请输入用户名和密码' })
    return
  }
  const result = await authService.login(username, password)
  if (!result) {
    res.status(401).json({ code: 1, message: '账号或密码错误' })
    return
  }
  res.json({ code: 0, data: result })
}))

/** GET /api/admin/me */
router.get('/me', requireAuth, (req, res) => {
  res.json({ code: 0, data: req.user })
})

/** GET /api/admin/stream - 后台侧 SSE，实时接收所有客户消息
 *  EventSource 不支持自定义头，token 通过 query 传入
 */
router.get('/stream', async (req, res) => {
  // 从 query 或 header 取 token
  const token = (req.query.token as string) || (req.headers.authorization?.replace('Bearer ', '') || '')
  if (!token) {
    res.status(401).json({ code: 1, message: '未登录' })
    return
  }
  const user = await authService.verifyToken(token)
  if (!user) {
    res.status(401).json({ code: 1, message: '登录已过期' })
    return
  }

  // SSE 头
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  res.write('\n')

  // 心跳保活（每 25 秒）
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n')
  }, 25_000)

  // 订阅全局 admin 通道
  const unsubscribe = subscribeAdmin((payload: any) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`)
  })

  // 客户端断开时清理
  req.on('close', () => {
    clearInterval(heartbeat)
    unsubscribe()
  })
})

// ========================
// 线索管理
// ========================

/** GET /api/admin/notifications?siteId=&since= - replay customer messages missed while admin was offline */
router.get('/notifications', requireAuth, wrap(async (req, res) => {
  const siteId = String(req.query.siteId || '')
  const sinceRaw = String(req.query.since || '')
  if (!siteId) {
    res.status(400).json({ code: 1, message: 'siteId is required' })
    return
  }

  const since = sinceRaw ? new Date(sinceRaw) : new Date()
  if (Number.isNaN(since.getTime())) {
    res.status(400).json({ code: 1, message: 'since must be a valid date' })
    return
  }

  const messages = await prisma.message.findMany({
    where: {
      role: 'user',
      createdAt: { gt: since },
      conversation: { siteId },
    },
    orderBy: { createdAt: 'asc' },
    take: 100,
    select: { id: true, conversationId: true, content: true, createdAt: true },
  })

  res.json({
    code: 0,
    data: messages.map((message) => ({ ...message, siteId })),
  })
}))

/** GET /api/admin/leads?page=1&size=20&status=&search=&siteId= */
router.get('/leads', requireAuth, wrap(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const size = Math.min(100, Math.max(1, Number(req.query.size) || 20))
  const { status, search, siteId } = req.query

  const where: any = {}
  if (status && status !== 'all') where.status = status
  if (siteId) where.conversation = { siteId }
  if (search) {
    where.OR = [
      { name: { contains: search as string, mode: 'insensitive' } },
      { phone: { contains: search as string, mode: 'insensitive' } },
      { email: { contains: search as string, mode: 'insensitive' } },
    ]
  }

  const [total, leads] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.findMany({
      where,
      include: {
        conversation: {
          select: {
            siteId: true,
            interestLevel: true,
            status: true,
            createdAt: true,
            lastMessageAt: true,
            site: { select: { name: true, domain: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * size,
      take: size,
    }),
  ])

  res.json({
    code: 0,
    data: {
      list: leads,
      total,
      page,
      size,
      totalPages: Math.ceil(total / size),
    },
  })
}))

// 必须注册在 /leads/:id 之前，避免 export 被当作线索 ID。
router.get('/leads/export', requireAuth, wrap(exportLeads))

/** GET /api/admin/leads/:id */
router.get('/leads/:id', requireAuth, wrap(async (req, res) => {
  const lead = await prisma.lead.findUnique({
    where: { id: req.params.id },
    include: {
      conversation: {
        include: {
          messages: { orderBy: { createdAt: 'asc' } },
          site: { select: { name: true, domain: true } },
        },
      },
    },
  })
  if (!lead) {
    res.status(404).json({ code: 1, message: '线索不存在' })
    return
  }
  res.json({ code: 0, data: lead })
}))

/** PATCH /api/admin/leads/:id - 改状态/备注/负责人 */
router.patch('/leads/:id', requireAuth, wrap(async (req, res) => {
  const { status, note, assignedTo } = req.body
  const data: any = {}
  if (status !== undefined) data.status = status
  if (note !== undefined) data.note = note
  if (assignedTo !== undefined) data.assignedTo = assignedTo

  const lead = await prisma.lead.update({
    where: { id: req.params.id },
    data,
  })
  res.json({ code: 0, data: lead })
}))

/** 导出当前站点的线索 CSV */
async function exportLeads(req: Request, res: Response): Promise<void> {
  const siteId = req.query.siteId as string | undefined
  const where = siteId ? { conversation: { siteId } } : {}

  const leads = await prisma.lead.findMany({
    where,
    include: {
      conversation: {
        select: {
          interestLevel: true,
          status: true,
          createdAt: true,
          site: { select: { name: true, domain: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  })

  const interestLabel: Record<string, string> = {
    unknown: '未知', low: '低', normal: '一般',
    medium: '中等', high: '高', strong: '极高',
  }
  const statusLabel: Record<string, string> = {
    new: '新线索', following: '跟进中', contacted: '已联系',
    converted: '已转化', discarded: '已废弃',
  }

  const header = ['来源站点', '站点网址', '姓名', '电话', '邮箱', '微信', '学历', '意向专业', '预算', '兴趣等级', '线索状态', '提交时间']
  const rows = leads.map((l: any) => [
    l.conversation?.site?.name || '', l.conversation?.site?.domain || '',
    l.name || '', l.phone || '', l.email || '', l.wechat || '',
    l.education || '', l.targetMajor || '', l.budget || '',
    interestLabel[l.conversation?.interestLevel] || '未知',
    statusLabel[l.status] || l.status,
    new Date(l.createdAt).toLocaleString('zh-CN'),
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))

  const csv = '\ufeff' + [header.map(h => `"${h}"`).join(','), ...rows].join('\r\n')
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename=leads.csv')
  res.send(csv)
}

// ========================
// 会话管理
// ========================

async function withVisitorNumbers<T extends { id: string; siteId: string; visitorId: string }>(items: T[], siteId?: string) {
  const where: any = { messages: { some: {} } }
  if (siteId) where.siteId = siteId
  const rows = await prisma.conversation.findMany({
    where,
    select: { id: true, siteId: true, visitorId: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })
  const nextBySite = new Map<string, number>()
  const numberByVisitor = new Map<string, number>()
  const numberByConversation = new Map<string, number>()
  for (const row of rows) {
    const visitorKey = `${row.siteId}:${row.visitorId}`
    let number = numberByVisitor.get(visitorKey)
    if (!number) {
      number = (nextBySite.get(row.siteId) || 0) + 1
      nextBySite.set(row.siteId, number)
      numberByVisitor.set(visitorKey, number)
    }
    numberByConversation.set(row.id, number)
  }
  return items.map((item) => ({ ...item, visitorNumber: numberByConversation.get(item.id) || 0 }))
}

/** GET /api/admin/conversations?page=1&size=20&status=&siteId= */
router.get('/conversations', requireAuth, wrap(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const size = Math.min(100, Math.max(1, Number(req.query.size) || 20))
  const { status, siteId } = req.query

  const where: any = { messages: { some: {} } }
  if (status && status !== 'all') where.status = status
  if (siteId) where.siteId = siteId

  const [total, conversations] = await Promise.all([
    prisma.conversation.count({ where }),
    prisma.conversation.findMany({
      where,
      include: {
        site: { select: { name: true, domain: true } },
        assignee: { select: { id: true, username: true, name: true, role: true } },
        _count: { select: { messages: true, leads: true } },
        leads: { select: { name: true, phone: true }, take: 1 },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, conversationId: true, role: true, content: true, source: true, createdAt: true },
        },
      },
      orderBy: [
        { lastMessageAt: 'desc' },
        { updatedAt: 'desc' },
        { createdAt: 'desc' },
      ],
      skip: (page - 1) * size,
      take: size,
    }),
  ])
  const numberedConversations = await withVisitorNumbers(conversations, typeof siteId === 'string' ? siteId : undefined)

  res.json({
    code: 0,
    data: {
      list: numberedConversations,
      total,
      page,
      size,
      totalPages: Math.ceil(total / size),
    },
  })
}))

/** GET /api/admin/conversations/:id - 会话详情（含完整消息） */
router.get('/conversations/:id', requireAuth, wrap(async (req, res) => {
  const conv = await prisma.conversation.findUnique({
    where: { id: req.params.id },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      site: { select: { name: true, domain: true } },
      assignee: { select: { id: true, username: true, name: true, role: true } },
      leads: true,
    },
  })
  if (!conv) {
    res.status(404).json({ code: 1, message: '会话不存在' })
    return
  }
  const [numbered] = await withVisitorNumbers([conv])
  res.json({ code: 0, data: numbered })
}))

/** POST /api/admin/conversations/:id/reply - 后台人工回复（推送到 widget SSE） */
router.post('/conversations/:id/reply', requireAuth, wrap(async (req, res) => {
  const { content } = req.body
  if (!content || !content.trim()) {
    res.status(400).json({ code: 1, message: '请输入回复内容' })
    return
  }

  const conversationId = req.params.id
  const conv = await prisma.conversation.findUnique({ where: { id: conversationId } })
  if (!conv) {
    res.status(404).json({ code: 1, message: '会话不存在' })
    return
  }

  // 自动接管（首次回复时）
  if (conv.status !== 'taken_over' && conv.status !== 'closed') {
    await chatService.takeOver(conversationId)
    if (req.user?.id) {
      await prisma.conversation.updateMany({ where: { id: conversationId, assigneeId: null }, data: { assigneeId: req.user.id } })
    }
  }

  // 存消息
  const msg = await chatService.saveMessage(conversationId, 'assistant', content.trim(), 'human')

  // 推送到 widget（客户侧实时收到）
  publish(conversationId, {
    event: 'agent_reply',
    data: {
      id: msg.id,
      conversationId,
      role: 'assistant',
      content: content.trim(),
      source: 'human',
      createdAt: msg.createdAt,
    },
  })

  // 推送到后台 admin 通道（多客服端实时看到彼此回复）
  publishAdmin({
    event: 'agent_reply',
    data: {
      id: msg.id,
      conversationId,
      siteId: conv.siteId,
      role: 'assistant',
      content: content.trim(),
      source: 'human',
      createdAt: msg.createdAt,
    },
  })

  res.json({ code: 0, data: msg })
}))

/** POST /api/admin/conversations/:id/takeover - 人工接管 */
router.post('/conversations/:id/takeover', requireAuth, wrap(async (req, res) => {
  await chatService.takeOver(req.params.id)
  if (req.user?.id) {
    await prisma.conversation.updateMany({ where: { id: req.params.id, assigneeId: null }, data: { assigneeId: req.user.id } })
  }
  res.json({ code: 0, message: '已接管' })
}))

/** POST /api/admin/conversations/:id/release - 释放接管，恢复 AI */
router.post('/conversations/:id/release', requireAuth, wrap(async (req, res) => {
  await chatService.releaseTakeOver(req.params.id)
  res.json({ code: 0, message: '已释放，AI 恢复自动回复' })
}))

// ========================
// 站点管理
// ========================

/** POST /api/admin/conversations/:id/resolve - 手动标记会话已处理 */
router.post('/conversations/:id/resolve', requireAuth, wrap(async (req, res) => {
  const conversation = await prisma.conversation.findUnique({ where: { id: req.params.id }, select: { id: true } })
  if (!conversation) {
    res.status(404).json({ code: 1, message: '会话不存在' })
    return
  }
  await prisma.conversation.update({
    where: { id: req.params.id },
    data: { status: 'closed', closedAt: new Date() },
  })
  res.json({ code: 0, message: '会话已标记为已处理' })
}))

/** POST /api/admin/conversations/:id/reopen - 重新打开已处理会话 */
router.post('/conversations/:id/reopen', requireAuth, requireAdmin, wrap(async (req, res) => {
  const conversation = await prisma.conversation.findUnique({ where: { id: req.params.id }, select: { id: true } })
  if (!conversation) {
    res.status(404).json({ code: 1, message: '会话不存在' })
    return
  }
  await prisma.conversation.update({
    where: { id: req.params.id },
    data: { status: 'active', closedAt: null },
  })
  res.json({ code: 0, message: '会话已重新打开' })
}))

/** GET /api/admin/conversation-assignees - 可分配的客服账号 */
router.get('/conversation-assignees', requireAuth, wrap(async (_req, res) => {
  const users = await prisma.adminUser.findMany({
    where: { role: { in: ['admin', 'staff'] } },
    select: { id: true, username: true, name: true, role: true },
    orderBy: [{ name: 'asc' }, { username: 'asc' }],
  })
  res.json({ code: 0, data: users })
}))

/** PATCH /api/admin/conversations/:id/assignee - 管理员设置负责人 */
router.patch('/conversations/:id/assignee', requireAuth, requireAdmin, wrap(async (req, res) => {
  const { assigneeId } = req.body || {}
  if (assigneeId !== null && typeof assigneeId !== 'string') {
    res.status(400).json({ code: 1, message: '负责人参数无效' })
    return
  }
  if (assigneeId) {
    const user = await prisma.adminUser.findUnique({ where: { id: assigneeId }, select: { id: true } })
    if (!user) {
      res.status(404).json({ code: 1, message: '负责人不存在' })
      return
    }
  }
  const conversation = await prisma.conversation.update({
    where: { id: req.params.id },
    data: { assigneeId: assigneeId || null },
    include: { assignee: { select: { id: true, username: true, name: true, role: true } } },
  })
  res.json({ code: 0, data: { assignee: conversation.assignee } })
}))

/** POST /api/admin/conversations/bulk-resolve - 管理员批量标记已处理 */
router.post('/conversations/bulk-resolve', requireAuth, requireAdmin, wrap(async (req, res) => {
  const rawIds: unknown[] = Array.isArray(req.body?.ids) ? req.body.ids : []
  const ids = Array.from(new Set(
    rawIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0),
  ))
  if (ids.length === 0 || ids.length > 100) {
    res.status(400).json({ code: 1, message: '请选择 1-100 个会话' })
    return
  }
  const result = await prisma.conversation.updateMany({
    where: { id: { in: ids }, status: { not: 'closed' } },
    data: { status: 'closed', closedAt: new Date() },
  })
  res.json({ code: 0, data: { count: result.count } })
}))

/** GET /api/admin/sites */
router.get('/sites', requireAuth, wrap(async (_req, res) => {
  const sites = await prisma.site.findMany({
    include: { _count: { select: { conversations: true, faqs: true } } },
    orderBy: { createdAt: 'desc' },
  })
  res.json({ code: 0, data: sites })
}))


/** POST /api/admin/sites - 创建站点（仅管理员） */
router.post('/sites', requireAuth, requireAdmin, wrap(async (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : ''
  const domain = normalizeSiteDomain(req.body.domain)
  if (!name) {
    res.status(400).json({ code: 1, message: '请输入站点名称' })
    return
  }
  if (!domain) {
    res.status(400).json({ code: 1, message: '请输入正确的网站域名，例如 luckyboy.me' })
    return
  }

  try {
    const site = await prisma.site.create({
      data: {
        name,
        domain,
        apiKey: generateSiteApiKey(),
        settings: {},
      },
    })
    res.status(201).json({ code: 0, data: site })
  } catch (error: any) {
    if (error?.code === 'P2002') {
      res.status(409).json({ code: 1, message: '这个网站域名已经存在' })
      return
    }
    throw error
  }
}))
/** PATCH /api/admin/sites/:id - 编辑站点配置 */
router.patch('/sites/:id', requireAuth, wrap(async (req, res) => {
  const { name, domain, settings } = req.body
  const data: any = {}
  if (name !== undefined) data.name = name
  if (domain !== undefined) {
    const normalizedDomain = normalizeSiteDomain(domain)
    if (!normalizedDomain) {
      res.status(400).json({ code: 1, message: '请输入正确的网站域名，例如 luckyboy.me' })
      return
    }
    data.domain = normalizedDomain
  }
  if (settings !== undefined) data.settings = settings

  const site = await prisma.site.update({
    where: { id: req.params.id },
    data,
  })
  res.json({ code: 0, data: site })
}))

/** POST /api/admin/sites/:id/test-wecom - 测试站点企业微信机器人 */
router.post('/sites/:id/test-wecom', requireAuth, wrap(async (req, res) => {
  const site = await prisma.site.findUnique({
    where: { id: req.params.id },
    select: { settings: true },
  })
  if (!site) {
    res.status(404).json({ code: 1, message: '站点不存在' })
    return
  }

  const settings = (
    site.settings && typeof site.settings === 'object' && !Array.isArray(site.settings)
  ) ? site.settings as Record<string, unknown> : {}
  const webhookUrl = typeof settings.webhookUrl === 'string' ? settings.webhookUrl.trim() : ''
  if (!webhookUrl) {
    res.status(400).json({ code: 1, message: '请先填写并保存企业微信机器人 Webhook' })
    return
  }

  const result = await sendWecomTest(webhookUrl)
  if (!result.ok) {
    res.status(502).json({ code: 1, message: `企业微信测试失败：${result.message}` })
    return
  }
  res.json({ code: 0, data: { status: result.status }, message: '测试消息已发送到企业微信群' })
}))
/** POST /api/admin/sites/:id/test-dify - 使用已保存配置测试 Dify 连接 */
router.post('/sites/:id/test-dify', requireAuth, wrap(async (req, res) => {
  const site = await prisma.site.findUnique({
    where: { id: req.params.id },
    select: { settings: true },
  })
  if (!site) {
    res.status(404).json({ code: 1, message: '站点不存在' })
    return
  }

  const settings = (
    site.settings && typeof site.settings === 'object' && !Array.isArray(site.settings)
  ) ? site.settings as Record<string, unknown> : {}
  const rawUrl = typeof settings.difyApiUrl === 'string' && settings.difyApiUrl.trim()
    ? settings.difyApiUrl.trim() : process.env.DIFY_API_URL
  const apiKey = typeof settings.difyApiKey === 'string' && settings.difyApiKey.trim()
    ? settings.difyApiKey.trim() : process.env.DIFY_API_KEY

  if (!rawUrl || !apiKey) {
    res.status(400).json({ code: 1, message: '请先保存 Dify API 地址和 API Key' })
    return
  }

  let infoUrl: string
  try {
    infoUrl = getDifyInfoUrl(rawUrl)
  } catch {
    res.status(400).json({ code: 1, message: 'Dify API 地址无效' })
    return
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8_000)
  try {
    const response = await fetch(infoUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    })
    if (!response.ok) {
      const message = response.status === 401 || response.status === 403
        ? 'Dify API Key 无效或无权访问该应用'
        : `Dify 连接失败（HTTP ${response.status}）`
      res.status(response.status >= 500 ? 502 : 400).json({ code: 1, message })
      return
    }

    const data = await response.json().catch(() => ({})) as Record<string, unknown>
    res.json({
      code: 0,
      data: {
        name: typeof data.name === 'string' ? data.name : 'Dify 应用',
        mode: typeof data.mode === 'string' ? data.mode : '',
      },
    })
  } catch (error) {
    const message = (error as Error).name === 'AbortError'
      ? 'Dify 连接超时，请检查 API 地址'
      : '无法连接 Dify，请检查网络和 API 地址'
    res.status(502).json({ code: 1, message })
  } finally {
    clearTimeout(timer)
  }
}))

// ========================
// FAQ 管理
// ========================

/** GET /api/admin/faqs?siteId=xxx */
router.get('/faqs', requireAuth, wrap(async (req, res) => {
  const { siteId } = req.query
  const where: any = siteId ? { siteId } : {}
  const faqs = await prisma.faq.findMany({
    where,
    include: { site: { select: { name: true } } },
    orderBy: [{ priority: 'asc' }],
  })
  res.json({ code: 0, data: faqs })
}))

/** POST /api/admin/faqs */
router.post('/faqs', requireAuth, wrap(async (req, res) => {
  const { siteId, question, answer, priority, language } = req.body
  if (!siteId || !question || !answer) {
    res.status(400).json({ code: 1, message: '缺少必填字段: siteId, question, answer' })
    return
  }
  const faq = await prisma.faq.create({
    data: { siteId, question, answer, language: language || 'zh-CN', priority: priority || 0 },
  })
  res.json({ code: 0, data: faq })
}))

/** PATCH /api/admin/faqs/:id */
router.patch('/faqs/:id', requireAuth, wrap(async (req, res) => {
  const { question, answer, priority, language } = req.body
  const data: any = {}
  if (question !== undefined) data.question = question
  if (answer !== undefined) data.answer = answer
  if (priority !== undefined) data.priority = priority
  if (language !== undefined) data.language = language

  const faq = await prisma.faq.update({
    where: { id: req.params.id },
    data,
  })
  res.json({ code: 0, data: faq })
}))

/** POST /api/admin/faqs/reorder - 保存指定语言的展示顺序 */
router.post('/faqs/reorder', requireAuth, wrap(async (req, res) => {
  const { siteId, language, orderedIds } = req.body
  if (!siteId || typeof language !== 'string' || !Array.isArray(orderedIds) || orderedIds.length === 0 || orderedIds.some((id: unknown) => typeof id !== 'string')) {
    res.status(400).json({ code: 1, message: '缺少有效的站点、语言或问题顺序' })
    return
  }

  const uniqueIds = new Set(orderedIds as string[])
  if (uniqueIds.size !== orderedIds.length) {
    res.status(400).json({ code: 1, message: '问题顺序中存在重复项' })
    return
  }

  const faqs = await prisma.faq.findMany({
    where: { siteId, language },
    select: { id: true },
  })
  const faqIds = new Set(faqs.map(faq => faq.id))
  if (orderedIds.some((id: string) => !faqIds.has(id)) || orderedIds.length !== faqs.length) {
    res.status(400).json({ code: 1, message: '问题顺序与当前语言的问题列表不一致，请刷新后重试' })
    return
  }

  await prisma.$transaction((orderedIds as string[]).map((id, index) => prisma.faq.update({
    where: { id },
    data: { priority: index + 1 },
  })))
  res.json({ code: 0, message: '展示顺序已保存' })
}))

/** DELETE /api/admin/faqs/:id */
router.delete('/faqs/:id', requireAuth, wrap(async (req, res) => {
  await prisma.faq.delete({ where: { id: req.params.id } })
  res.json({ code: 0, message: '已删除' })
}))

// ========================
// 账号管理（仅 admin）
// ========================

/** GET /api/admin/users */
router.get('/users', requireAuth, requireAdmin, wrap(async (_req, res) => {
  const users = await prisma.adminUser.findMany({
    select: { id: true, username: true, role: true, name: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })
  res.json({ code: 0, data: users })
}))

/** POST /api/admin/users */
router.post('/users', requireAuth, requireAdmin, wrap(async (req, res) => {
  const { username, password, role, name } = req.body
  if (!username || !password) {
    res.status(400).json({ code: 1, message: '请输入用户名和密码' })
    return
  }
  const existing = await prisma.adminUser.findUnique({ where: { username } })
  if (existing) {
    res.status(409).json({ code: 1, message: '用户名已存在' })
    return
  }
  const user = await authService.createUser(username, password, role || 'staff', name)
  res.json({ code: 0, data: user })
}))

/** PATCH /api/admin/users/:id - 改密码/角色/姓名 */
router.patch('/users/:id', requireAuth, requireAdmin, wrap(async (req, res) => {
  const { password, role, name } = req.body
  const data: any = {}
  if (role !== undefined) data.role = role
  if (name !== undefined) data.name = name

  if (password) {
    await authService.changePassword(req.params.id, password)
  }
  if (Object.keys(data).length > 0) {
    await prisma.adminUser.update({ where: { id: req.params.id }, data })
  }
  res.json({ code: 0, message: '已更新' })
}))

/** DELETE /api/admin/users/:id */
router.delete('/users/:id', requireAuth, requireAdmin, wrap(async (req, res) => {
  if (req.params.id === req.user?.id) {
    res.status(400).json({ code: 1, message: '不能删除自己' })
    return
  }
  await prisma.adminUser.delete({ where: { id: req.params.id } })
  res.json({ code: 0, message: '已删除' })
}))

export default router
