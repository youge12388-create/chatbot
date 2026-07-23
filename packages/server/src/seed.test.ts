import assert from 'node:assert/strict'
import test from 'node:test'

const { seedDefaultFaqs, ensureAdminUser } = require('../prisma/seed.js') as {
  seedDefaultFaqs: (client: unknown, siteId: string) => Promise<void>,
  ensureAdminUser: (client: unknown, username: string, password: string, role: string, name: string) => Promise<any>
}

test('已有 FAQ 时保留后台维护的数据', async () => {
  let createManyCalled = false
  const client = {
    faq: {
      count: async () => 2,
      createMany: async () => {
        createManyCalled = true
      },
    },
  }

  await seedDefaultFaqs(client, 'site-1')

  assert.equal(createManyCalled, false)
})

test('FAQ 为空时写入默认数据', async () => {
  let createdData: Array<{ siteId: string; question: string }> = []
  const client = {
    faq: {
      count: async () => 0,
      createMany: async ({ data }: { data: Array<{ siteId: string; question: string }> }) => {
        createdData = data
      },
    },
  }

  await seedDefaultFaqs(client, 'site-1')

  assert.equal(createdData.length, 3)
  assert.ok(createdData.every((faq) => faq.siteId === 'site-1'))
})
test('seed preserves an existing admin password on service restart', async () => {
  const existing = { id: 'admin-1', username: 'admin', password: 'existing-hash', role: 'admin', name: '管理员' }
  let createCalls = 0
  const client = {
    adminUser: {
      findUnique: async () => existing,
      create: async () => { createCalls += 1; return existing },
    },
  }

  const result = await ensureAdminUser(client, 'admin', 'new-env-password', 'admin', '管理员')
  assert.equal(result, existing)
  assert.equal(createCalls, 0)
})

test('seed creates a missing admin with a hashed password', async () => {
  let created: any
  const client = {
    adminUser: {
      findUnique: async () => null,
      create: async ({ data }: any) => { created = data; return { id: 'admin-2', ...data } },
    },
  }

  const result = await ensureAdminUser(client, 'admin', 'new-env-password', 'admin', '管理员')
  assert.equal(result.username, 'admin')
  assert.equal(created.password === 'new-env-password', false)
  assert.equal(created.role, 'admin')
})
