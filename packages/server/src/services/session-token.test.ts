import assert from 'node:assert/strict'
import test from 'node:test'
import {
  hashSessionToken,
  issueSessionToken,
  matchesSessionToken,
} from './session-token'

test('会话令牌只保存哈希且可校验', () => {
  const credential = issueSessionToken(new Date('2026-07-20T00:00:00.000Z'), 60_000)

  assert.ok(credential.token)
  assert.notEqual(credential.tokenHash, credential.token)
  assert.equal(matchesSessionToken(credential.token, credential.tokenHash), true)
  assert.equal(matchesSessionToken('wrong-token', credential.tokenHash), false)
  assert.equal(credential.expiresAt.toISOString(), '2026-07-20T00:01:00.000Z')
  assert.equal(hashSessionToken(credential.token), credential.tokenHash)
})