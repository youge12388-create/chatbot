import assert from 'node:assert/strict'
import test from 'node:test'
import { getNotificationRetryDelay } from './notification-outbox'

test('通知重试采用递增退避并封顶', () => {
  assert.equal(getNotificationRetryDelay(1), 60_000)
  assert.equal(getNotificationRetryDelay(2), 300_000)
  assert.equal(getNotificationRetryDelay(5), 43_200_000)
  assert.equal(getNotificationRetryDelay(10), 43_200_000)
})