import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import path from 'path'
import chatRoutes from './routes/chat'
import adminRoutes from './routes/admin'

const app = express()
const PORT = process.env.PORT || 3001

// 中间件
app.use(cors())
app.use(express.json())

// 提供 widget.js 静态文件
app.use(express.static(path.join(__dirname, '../public')))

// 路由
app.use('/api/chat', chatRoutes)
app.use('/api/admin', adminRoutes)

// 后台 SPA：/admin 及其子路径返回 admin/index.html
const adminDir = path.join(__dirname, '../public/admin')
app.use('/admin', express.static(adminDir, { index: false }))
app.get(['/admin', '/admin/*'], (_req, res) => {
  res.sendFile(path.join(adminDir, 'index.html'))
})

// 健康检查（同时兼容根路径，避免部分网关默认探针 404）
app.get(['/', '/api/health'], (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() })
})

// 全局错误处理
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[chat-api] unhandled error:', err.message)
  res.status(500).json({
    code: 1,
    message: process.env.NODE_ENV === 'production'
      ? '服务器内部错误'
      : err.message,
  })
})

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`[chat-api] running on http://0.0.0.0:${PORT}`)
})