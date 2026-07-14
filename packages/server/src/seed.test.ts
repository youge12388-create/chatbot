import assert from 'node:assert/strict'
import test from 'node:test'

const { seedDefaultFaqs } = require('../prisma/seed.js') as {
  seedDefaultFaqs: (client: unknown, siteId: string) => Promise<void>
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