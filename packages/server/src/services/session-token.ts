import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export const SESSION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000

export interface SessionTokenCredential {
  token: string
  tokenHash: string
  expiresAt: Date
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function issueSessionToken(
  now: Date = new Date(),
  ttlMs: number = SESSION_TOKEN_TTL_MS,
): SessionTokenCredential {
  const token = randomBytes(32).toString('base64url')
  return {
    token,
    tokenHash: hashSessionToken(token),
    expiresAt: new Date(now.getTime() + ttlMs),
  }
}

export function matchesSessionToken(token: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashSessionToken(token), 'utf8')
  const expected = Buffer.from(expectedHash, 'utf8')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}