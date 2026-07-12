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
import { prisma } from '../db/client'
import { chatService } from '../services/chat'
import { authService } from '../services/auth'
import { requireAuth, requireAdmin } from '../middleware/auth'
import { publish } from '../services/pubsub'

const router = Router()

// ---- 工具 ----

type AsyncHandler = (req: Request, res: Response) => Promise<void>
function wrap(fn: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next)
  }
}

// ========================
// 认证
// ========================

/** POST /api/admin/login */
router.post('/login', wrap(async (req, res) => {
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

// ========================
// 线索管理
// ========================

/** GET /api/admin/leads?page=1&size=20&status=&search= */
router.get('/leads', requireAuth, wrap(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const size = Math.min(100, Math.max(1, Number(req.query.size) || 20))
  const { status, search } = req.query

  const where: any = {}
  if (status && status !== 'all') where.status = status
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
          select: { interestLevel: true, status: true, createdAt: true, lastMessageAt: true },
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

/** GET /api/admin/leads/export - 导出 CSV */
router.get('/leads/export', requireAuth, wrap(async (_req, res) => {
  const leads = await prisma.lead.findMany({
    include: {
      conversation: { select: { interestLevel: true, status: true, createdAt: true } },
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

  const header = ['姓名', '电话', '邮箱', '微信', '学历', '意向专业', '预算', '兴趣等级', '线索状态', '提交时间']
  const rows = leads.map((l: any) => [
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
}))

// ========================
// 会话管理
// ========================

/** GET /api/admin/conversations?page=1&size=20&status=&siteId= */
router.get('/conversations', requireAuth, wrap(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const size = Math.min(100, Math.max(1, Number(req.query.size) || 20))
  const { status, siteId } = req.query

  const where: any = {}
  if (status && status !== 'all') where.status = status
  if (siteId) where.siteId = siteId

  const [total, conversations] = await Promise.all([
    prisma.conversation.count({ where }),
    prisma.conversation.findMany({
      where,
      include: {
        site: { select: { name: true, domain: true } },
        _count: { select: { messages: true, leads: true } },
        leads: { select: { name: true, phone: true }, take: 1 },
      },
      orderBy: { lastMessageAt: 'desc' },
      skip: (page - 1) * size,
      take: size,
    }),
  ])

  res.json({
    code: 0,
    data: {
      list: conversations,
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
      leads: true,
    },
  })
  if (!conv) {
    res.status(404).json({ code: 1, message: '会话不存在' })
    return
  }
  res.json({ code: 0, data: conv })
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
  if (conv.status === 'active') {
    await chatService.takeOver(conversationId)
  }

  // 存消息
  const msg = await chatService.saveMessage(conversationId, 'assistant', content.trim(), 'human')

  // 推送到 widget
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

  res.json({ code: 0, data: msg })
}))

/** POST /api/admin/conversations/:id/takeover - 人工接管 */
router.post('/conversations/:id/takeover', requireAuth, wrap(async (req, res) => {
  await chatService.takeOver(req.params.id)
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

/** GET /api/admin/sites */
router.get('/sites', requireAuth, wrap(async (_req, res) => {
  const sites = await prisma.site.findMany({
    include: { _count: { select: { conversations: true, faqs: true } } },
    orderBy: { createdAt: 'desc' },
  })
  res.json({ code: 0, data: sites })
}))

/** PATCH /api/admin/sites/:id - 编辑站点配置 */
router.patch('/sites/:id', requireAuth, wrap(async (req, res) => {
  const { name, settings } = req.body
  const data: any = {}
  if (name !== undefined) data.name = name
  if (settings !== undefined) data.settings = settings

  const site = await prisma.site.update({
    where: { id: req.params.id },
    data,
  })
  res.json({ code: 0, data: site })
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
  const { siteId, question, answer, priority } = req.body
  if (!siteId || !question || !answer) {
    res.status(400).json({ code: 1, message: '缺少必填字段: siteId, question, answer' })
    return
  }
  const faq = await prisma.faq.create({
    data: { siteId, question, answer, priority: priority || 0 },
  })
  res.json({ code: 0, data: faq })
}))

/** PATCH /api/admin/faqs/:id */
router.patch('/faqs/:id', requireAuth, wrap(async (req, res) => {
  const { question, answer, priority } = req.body
  const data: any = {}
  if (question !== undefined) data.question = question
  if (answer !== undefined) data.answer = answer
  if (priority !== undefined) data.priority = priority

  const faq = await prisma.faq.update({
    where: { id: req.params.id },
    data,
  })
  res.json({ code: 0, data: faq })
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
