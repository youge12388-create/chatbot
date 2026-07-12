/**
 * 认证服务
 *
 * 职责：
 * - 登录校验（用户名+密码）
 * - 签发 JWT
 * - 解析 JWT 拿用户
 */

import { prisma } from '../db/client'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'
const JWT_EXPIRES_IN = '7d'

export interface AdminUserPublic {
  id: string
  username: string
  role: string
  name: string | null
}

/** 登录：校验密码，签发 JWT */
async function login(username: string, password: string): Promise<{ token: string; user: AdminUserPublic } | null> {
  const user = await prisma.adminUser.findUnique({ where: { username } })
  if (!user) return null

  const ok = await bcrypt.compare(password, user.password)
  if (!ok) return null

  const token = jwt.sign(
    { sub: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  )

  return {
    token,
    user: { id: user.id, username: user.username, role: user.role, name: user.name },
  }
}

/** 解析 token，返回用户公开信息（不含密码） */
async function verifyToken(token: string): Promise<AdminUserPublic | null> {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string }
    const user = await prisma.adminUser.findUnique({
      where: { id: payload.sub },
      select: { id: true, username: true, role: true, name: true },
    })
    return user
  } catch {
    return null
  }
}

/** 创建账号 */
async function createUser(username: string, password: string, role: string, name?: string): Promise<AdminUserPublic> {
  const hashed = await bcrypt.hash(password, 10)
  const user = await prisma.adminUser.create({
    data: { username, password: hashed, role, name },
    select: { id: true, username: true, role: true, name: true },
  })
  return user
}

/** 改密码 */
async function changePassword(userId: string, newPassword: string): Promise<void> {
  const hashed = await bcrypt.hash(newPassword, 10)
  await prisma.adminUser.update({
    where: { id: userId },
    data: { password: hashed },
  })
}

export const authService = {
  login,
  verifyToken,
  createUser,
  changePassword,
}
