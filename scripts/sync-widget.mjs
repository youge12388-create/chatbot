import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = resolve(root, 'packages/widget/dist/widget.js')
const target = resolve(root, 'packages/server/public/widget.js')

await mkdir(dirname(target), { recursive: true })
await copyFile(source, target)
console.log('[build] widget.js synced to server/public')

