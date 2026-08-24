import assert from 'node:assert/strict'
import test from 'node:test'
import type { Request, Response, NextFunction } from 'express'
import { createRateLimiter, getClientIp } from './rate-limit'

function mockRequest(ip?: string, forwarded?: string) {
  return {
    headers: { 'x-forwarded-for': forwarded },
    socket: { remoteAddress: ip || '127.0.0.1' },
  } as unknown as Request
}

function mockResponse() {
  const res: Partial<Response> = {
    statusCode: 200,
    setHeader: () => res as Response,
    status: (code: number) => {
      ;(res as Response).statusCode = code
      return res as Response
    },
    json: () => res as Response,
  }
  return res as Response
}

test('reads the first client ip from x-forwarded-for', () => {
  const req = mockRequest('10.0.0.1', '203.0.113.5, 10.0.0.1')
  assert.equal(getClientIp(req), '203.0.113.5')
})

test('allows requests within the window and rejects over the limit', () => {
  let called = 0
  let nexted = 0
  const middleware = createRateLimiter({ windowMs: 60_000, max: 3 })
  const req = mockRequest('1.1.1.1')
  const res = mockResponse()
  const next: NextFunction = () => { nexted += 1 }

  for (let i = 0; i < 3; i += 1) {
    middleware(req, res, next)
    called += 1
    assert.equal(nexted, called)
  }
  middleware(req, res, next)
  assert.equal(res.statusCode, 429)
  assert.equal(nexted, 3)
})

test('limits are counted per client ip', () => {
  const middleware = createRateLimiter({ windowMs: 60_000, max: 1 })
  const a = mockRequest('1.1.1.1')
  const b = mockRequest('2.2.2.2')
  const nextA: NextFunction = () => {}
  const nextB: NextFunction = () => {}
  middleware(a, mockResponse(), nextA)
  middleware(b, mockResponse(), nextB)
  const resB = mockResponse()
  middleware(b, resB, nextB)
  assert.equal(resB.statusCode, 429)
})

test('is bypassed when RATE_LIMIT_DISABLED is set', () => {
  const previous = process.env.RATE_LIMIT_DISABLED
  process.env.RATE_LIMIT_DISABLED = '1'
  try {
    const middleware = createRateLimiter({ windowMs: 60_000, max: 0 })
    const req = mockRequest('1.1.1.1')
    let nexted = 0
    middleware(req, mockResponse(), () => { nexted += 1 })
    assert.equal(nexted, 1)
  } finally {
    if (previous === undefined) delete process.env.RATE_LIMIT_DISABLED
    else process.env.RATE_LIMIT_DISABLED = previous
  }
})
