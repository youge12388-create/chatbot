import assert from 'node:assert/strict'
import test from 'node:test'
import bcrypt from 'bcryptjs'
import { prisma } from '../db/client'
import { authService } from './auth'

function replaceMethod(object: object, key: string, value: unknown): () => void {
  const target = object as Record<string, unknown>
  const original = target[key]
  target[key] = value
  return () => { target[key] = original }
}

test('login rejects missing users and incorrect passwords', async () => {
  const restore = replaceMethod(prisma.adminUser, 'findUnique', async () => null)
  try {
    assert.equal(await authService.login('missing', 'secret'), null)
  } finally { restore() }

  const password = await bcrypt.hash('correct', 4)
  const restoreUser = replaceMethod(prisma.adminUser, 'findUnique', async () => ({
    id: 'user-1', username: 'staff', password, role: 'staff', name: null,
  }))
  try {
    assert.equal(await authService.login('staff', 'wrong'), null)
  } finally { restoreUser() }
})

test('login signs a token and verifyToken returns public user data', async () => {
  const password = await bcrypt.hash('correct', 4)
  let lookup = 0
  const restore = replaceMethod(prisma.adminUser, 'findUnique', async () => {
    lookup += 1
    if (lookup === 1) return { id: 'user-1', username: 'staff', password, role: 'staff', name: 'Staff' }
    return { id: 'user-1', username: 'staff', role: 'staff', name: 'Staff' }
  })
  try {
    const result = await authService.login('staff', 'correct')
    assert.ok(result?.token)
    assert.deepEqual(result?.user, { id: 'user-1', username: 'staff', role: 'staff', name: 'Staff' })
    assert.deepEqual(await authService.verifyToken(result!.token), result!.user)
  } finally { restore() }
})

test('verifyToken returns null for invalid tokens or deleted users', async () => {
  assert.equal(await authService.verifyToken('not-a-token'), null)
  const original = (prisma.adminUser as any).findUnique
  const password = await bcrypt.hash('correct', 4)
  ;(prisma.adminUser as any).findUnique = async () => ({
    id: 'user-2', username: 'admin', password, role: 'admin', name: null,
  })
  try {
    const result = await authService.login('admin', 'correct')
    ;(prisma.adminUser as any).findUnique = async () => null
    assert.equal(await authService.verifyToken(result!.token), null)
  } finally { (prisma.adminUser as any).findUnique = original }
})

test('createUser hashes passwords and changePassword updates only the hash', async () => {
  let created: any
  const createRestore = replaceMethod(prisma.adminUser, 'create', async ({ data }: any) => {
    created = data
    return { id: 'user-3', username: data.username, role: data.role, name: data.name }
  })
  let updated: any
  const updateRestore = replaceMethod(prisma.adminUser, 'update', async ({ data }: any) => {
    updated = data
    return {}
  })
  try {
    const user = await authService.createUser('new-user', 'secret', 'staff', 'New User')
    assert.deepEqual(user, { id: 'user-3', username: 'new-user', role: 'staff', name: 'New User' })
    assert.equal(await bcrypt.compare('secret', created.password), true)
    await authService.changePassword('user-3', 'new-secret')
    assert.equal(await bcrypt.compare('new-secret', updated.password), true)
  } finally {
    createRestore()
    updateRestore()
  }
})