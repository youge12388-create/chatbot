import assert from 'node:assert/strict'
import test from 'node:test'
import router from './admin'

test('线索导出路由注册在线索详情路由之前', () => {
  const paths = (router as unknown as {
    stack: Array<{ route?: { path?: string } }>
  }).stack.map((layer) => layer.route?.path).filter(Boolean)

  const exportIndex = paths.indexOf('/leads/export')
  const detailIndex = paths.indexOf('/leads/:id')

  assert.notEqual(exportIndex, -1)
  assert.notEqual(detailIndex, -1)
  assert.ok(exportIndex < detailIndex)
})
