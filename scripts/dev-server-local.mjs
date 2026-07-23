import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { startLocalPostgres, prepareLocalDatabase, getLocalEnv } from './local-postgres.mjs'

const { config, postgres } = await startLocalPostgres()
await prepareLocalDatabase(config)
const tsxCli = fileURLToPath(new URL('../node_modules/tsx/dist/cli.mjs', import.meta.url))
const server = spawn(process.execPath, [tsxCli, 'watch', 'src/index.ts'], {
  cwd: fileURLToPath(new URL('../packages/server/', import.meta.url)),
  env: getLocalEnv(config),
  stdio: 'inherit',
})

let shuttingDown = false
const shutdown = async (exitCode = 0) => {
  if (shuttingDown) return
  shuttingDown = true
  server.kill()
  await postgres.stop()
  process.exitCode = exitCode
}

process.once('SIGINT', () => shutdown(0))
process.once('SIGTERM', () => shutdown(0))
server.once('exit', (code) => shutdown(code || 0))