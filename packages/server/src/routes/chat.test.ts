import assert from 'node:assert/strict'
import test from 'node:test'
import router from './chat'

test('公开聊天路由不再注册线索调试接口', () => {
  const paths = (router as unknown as {
    stack: Array<{ route?: { path?: string } }>
  }).stack.map((layer) => layer.route?.path).filter(Boolean)

  assert.equal(paths.includes('/leads'), false)
  assert.equal(paths.includes('/leads/html'), false)
  assert.equal(paths.includes('/leads/test-notify'), false)
})
