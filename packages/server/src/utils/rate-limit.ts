import type { Request, Response, NextFunction } from 'express'

export interface RateLimiterOptions {
  windowMs: number
  max: number
  message?: string
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string') {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  return req.socket.remoteAddress || 'unknown'
}

/**
 * Fixed-window in-memory limiter keyed by client IP. Set RATE_LIMIT_DISABLED=1
 * to bypass (used by the load-test so a single-IP run is not throttled).
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const { windowMs, max } = options
  const hits = new Map<string, { count: number; resetAt: number }>()

  return (req: Request, res: Response, next: NextFunction) => {
    if (process.env.RATE_LIMIT_DISABLED === '1') {
      next()
      return
    }
    const now = Date.now()
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key)
    }
    const ip = getClientIp(req)
    let entry = hits.get(ip)
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs }
      hits.set(ip, entry)
    }
    entry.count += 1
    if (entry.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)))
      res.status(429).json({ code: 1, message: options.message || '请求过于频繁，请稍后再试' })
      return
    }
    next()
  }
}
