import { cp, mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = resolve(root, 'packages/admin/dist')
const target = resolve(root, 'packages/server/public/admin')

await mkdir(target, { recursive: true })
await cp(source, target, { recursive: true })
console.log('[build] admin dist synced to server/public/admin')
