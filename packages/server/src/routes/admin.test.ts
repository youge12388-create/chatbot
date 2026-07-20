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

test('FAQ 顺序路由注册为 POST', () => {
  const layers = (router as unknown as {
    stack: Array<{ route?: { path?: string; methods?: Record<string, boolean> } }>
  }).stack
  const reorderRoute = layers.find((layer) => layer.route?.path === '/faqs/reorder' && layer.route.methods?.post)
  assert.ok(reorderRoute)
})
test('新增站点路由注册为 POST', () => {
  const layers = (router as unknown as {
    stack: Array<{ route?: { path?: string; methods?: Record<string, boolean> } }>
  }).stack
  const createRoute = layers.find((layer) => layer.route?.path === '/sites' && layer.route.methods?.post)
  assert.ok(createRoute)
})


test('offline notification replay route is registered as GET', () => {
  const layers = (router as unknown as {
    stack: Array<{ route?: { path?: string; methods?: Record<string, boolean> } }>
  }).stack
  const route = layers.find((layer) => layer.route?.path === '/notifications' && layer.route.methods?.get)
  assert.ok(route)
})

test('delete site route is registered as DELETE', () => {
  const layers = (router as unknown as {
    stack: Array<{ route?: { path?: string; methods?: Record<string, boolean> } }>
  }).stack
  const deleteRoute = layers.find((layer) => layer.route?.path === '/sites/:id' && layer.route.methods?.delete)
  assert.ok(deleteRoute)
})
test('site edit route is registered as PATCH', () => {
  const layers = (router as unknown as {
    stack: Array<{ route?: { path?: string; methods?: Record<string, boolean> } }>
  }).stack
  const editRoute = layers.find((layer) => layer.route?.path === '/sites/:id' && layer.route.methods?.patch)
  assert.ok(editRoute)
})
