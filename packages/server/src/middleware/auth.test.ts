import assert from 'node:assert/strict'
import test from 'node:test'
import { requireAdmin, requireAuth } from '../middleware/auth'
import { authService } from '../services/auth'

function response() {
  const result: { statusCode?: number; body?: unknown } = {}
  return {
    result,
    status(code: number) { result.statusCode = code; return this },
    json(body: unknown) { result.body = body; return this },
  } as any
}

test('requireAuth rejects missing and invalid bearer tokens', async () => {
  const missing = response()
  let nextCalls = 0
  await requireAuth({ headers: {} } as any, missing, () => { nextCalls += 1 })
  assert.equal(missing.result.statusCode, 401)
  assert.equal(nextCalls, 0)

  const restore = (authService as any).verifyToken
  ;(authService as any).verifyToken = async () => null
  try {
    const invalid = response()
    await requireAuth({ headers: { authorization: 'Bearer expired' } } as any, invalid, () => { nextCalls += 1 })
    assert.equal(invalid.result.statusCode, 401)
  } finally { (authService as any).verifyToken = restore }
})

test('requireAuth attaches the user and requireAdmin checks the role', async () => {
  const restore = (authService as any).verifyToken
  ;(authService as any).verifyToken = async () => ({ id: 'u1', username: 'staff', role: 'staff', name: null })
  try {
    const req: any = { headers: { authorization: 'Bearer valid' } }
    const res = response()
    let nextCalls = 0
    await requireAuth(req, res, () => { nextCalls += 1 })
    assert.equal(nextCalls, 1)
    assert.equal(req.user.role, 'staff')

    const denied = response()
    requireAdmin(req, denied, () => { nextCalls += 1 })
    assert.equal(denied.result.statusCode, 403)

    req.user.role = 'admin'
    let adminNext = 0
    requireAdmin(req, response(), () => { adminNext += 1 })
    assert.equal(adminNext, 1)
  } finally { (authService as any).verifyToken = restore }
})