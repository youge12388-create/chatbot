/**
 * Startup bootstrap: prepares the database and then starts the HTTP server.
 *
 * Flow:
 * 1. prisma db push (create tables)
 * 2. seed defaults
 * 3. start Express
 *
 * With REDIS_URL configured, schema/seed run under a short-lived Redis lock so
 * multiple instances can start at the same time without racing each other.
 * A failing optional step is logged and does not block the server.
 */

import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { resolve } from 'path'
import { createClient } from 'redis'

const seedFile = resolve(__dirname, '../prisma/seed.js')

async function acquireInitLock(): Promise<boolean> {
  const url = process.env.REDIS_URL
  if (!url) return true
  const client = createClient({ url })
  try {
    await client.connect()
    const result = await client.set('chatbot:init:lock', String(Date.now()), {
      NX: true,
      EX: 120,
    })
    return result === 'OK'
  } catch (err) {
    console.warn('[bootstrap] redis lock unavailable, initializing anyway:', (err as Error).message)
    return true
  } finally {
    await client.destroy()
  }
}

async function main(): Promise<void> {
  const locked = await acquireInitLock()
  if (!locked) {
    console.log('[bootstrap] another instance holds the init lock, skipping schema/seed')
    return
  }

  try {
    console.log('[bootstrap] syncing database schema...')
    execSync('npx prisma db push', {
      stdio: 'inherit',
      env: process.env,
      cwd: resolve(__dirname, '..'),
    })
    console.log('[bootstrap] database schema sync complete')
  } catch (err) {
    console.error('[bootstrap] prisma db push failed, continuing:', (err as Error).message)
  }

  if (existsSync(seedFile)) {
    try {
      console.log('[bootstrap] seeding default data...')
      execSync(`node "${seedFile}"`, { stdio: 'inherit', env: process.env })
      console.log('[bootstrap] seed complete')
    } catch (err) {
      console.error('[bootstrap] seed failed, continuing:', (err as Error).message)
    }
  }
}

main()
  .then(() => {
    require('./index')
  })
  .catch((err) => {
    console.error('[bootstrap] startup failed:', err)
    process.exit(1)
  })
