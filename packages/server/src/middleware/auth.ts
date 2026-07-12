/**
 * 认证中间件
 *
 * - requireAuth: 校验 JWT,挂载 req.user
 * - requireAdmin: 在 requireAuth 基础上要求 role=admin
 */

import { Request, Response, NextFunction } from 'express'
import { authService, AdminUserPublic } from '../services/auth'

// 扩展 Express Request 类型
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AdminUserPublic
    }
  }
}

/** 从 Authorization 头提取 token */
function extractToken(req: Request): string | null {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) return null
  return header.slice(7)
}

/** 校验 JWT，挂载 req.user */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req)
  if (!token) {
    res.status(401).json({ code: 1, message: '未登录' })
    return
  }

  const user = await authService.verifyToken(token)
  if (!user) {
    res.status(401).json({ code: 1, message: '登录已过期' })
    return
  }

  req.user = user
  next()
}

/** 要求 admin 角色（需先经过 requireAuth） */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ code: 1, message: '权限不足' })
    return
  }
  next()
}
