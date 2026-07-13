/**
 * API 请求封装
 *
 * - 自动携带 Authorization 头
 * - 401 清 token 跳 /login
 * - 返回后端 data 字段
 */

import type { AdminUser } from '../types'

const TOKEN_KEY = 'admin_token'

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function clearTokenAndRedirect(): void {
  localStorage.removeItem(TOKEN_KEY)
  if (location.pathname !== '/admin/login') {
    location.href = '/admin/login'
  }
}

export async function request<T = unknown>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  data?: Record<string, unknown> | unknown,
): Promise<T> {
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  let body: string | undefined
  let query = ''
  if (data !== undefined && method !== 'GET') {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(data)
  } else if (data !== undefined && method === 'GET') {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      if (v !== undefined && v !== null && v !== '') {
        params.append(k, String(v))
      }
    }
    const qs = params.toString()
    if (qs) query = `?${qs}`
  }

  const res = await fetch(`${url}${query}`, {
    method,
    headers,
    body,
  })

  if (res.status === 401) {
    clearTokenAndRedirect()
    throw new Error('登录已过期')
  }

  // CSV 导出等非 JSON 响应直接返回
  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    return res.text() as unknown as T
  }

  const json = await res.json()
  if (json.code !== 0) {
    throw new Error(json.message || '请求失败')
  }
  return json.data as T
}

/** SSE 流式地址（用于 EventSource，需手动拼 token 因为 EventSource 不支持自定义头） */
export function sseUrl(conversationId: string): string {
  const token = getToken()
  const t = token ? `&token=${encodeURIComponent(token)}` : ''
  return `/api/chat/stream?conversationId=${encodeURIComponent(conversationId)}${t}`
}

/** 后台 SSE 端点（实时接收客户消息，JWT 拼到 query 因 EventSource 不支持自定义头） */
export function adminSseUrl(): string {
  const token = getToken()
  const t = token ? `?token=${encodeURIComponent(token)}` : ''
  return `/api/admin/stream${t}`
}

/** 当前登录用户快捷读取（从 localStorage 缓存） */
export function getCachedUser(): AdminUser | null {
  const raw = localStorage.getItem('admin_user')
  if (!raw) return null
  try {
    return JSON.parse(raw) as AdminUser
  } catch {
    return null
  }
}

export function cacheUser(user: AdminUser | null): void {
  if (user) {
    localStorage.setItem('admin_user', JSON.stringify(user))
  } else {
    localStorage.removeItem('admin_user')
  }
}
