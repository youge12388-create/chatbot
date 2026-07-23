import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { existsSync, readFileSync, unlinkSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const schemaPath = resolve(rootDir, 'packages/server/prisma/schema.prisma')
const seedPath = resolve(rootDir, 'packages/server/prisma/seed.js')

export function getLocalDatabaseConfig() {
  const port = Number(process.env.LOCAL_DB_PORT || 55432)
  const database = process.env.LOCAL_DB_NAME || 'chatbot'
  const user = process.env.LOCAL_DB_USER || 'postgres'
  const password = process.env.LOCAL_DB_PASSWORD || 'postgres'
  return {
    port,
    database,
    user,
    password,
    databaseDir: resolve(rootDir, 'data/local-postgres'),
    url: `postgresql://${user}:${password}@127.0.0.1:${port}/${database}`,
  }
}

function clearStalePostmasterPid(config) {
  const pidFile = resolve(config.databaseDir, 'postmaster.pid')
  if (!existsSync(pidFile)) return

  const binaryName = process.platform === 'win32'
    ? 'windows-x64'
    : process.platform === 'darwin'
      ? (process.arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64')
      : 'linux-x64'
  const pgCtlName = process.platform === 'win32' ? 'pg_ctl.exe' : 'pg_ctl'
  const pgCtl = resolve(rootDir, 'node_modules', `@embedded-postgres/${binaryName}/native/bin/${pgCtlName}`)

  try {
    execFileSync(pgCtl, ['status', '-D', config.databaseDir], { stdio: 'ignore' })
    return
  } catch {
    unlinkSync(pidFile)
    console.log('[local-db] removed stale postmaster.pid')
  }
}
export async function startLocalPostgres() {
  const config = getLocalDatabaseConfig()
  const postgres = new EmbeddedPostgres({
    databaseDir: config.databaseDir,
    user: config.user,
    password: config.password,
    port: config.port,
    persistent: true,
  })

  clearStalePostmasterPid(config)
  if (!existsSync(resolve(config.databaseDir, 'PG_VERSION'))) {
    await postgres.initialise()
  }
  await postgres.start()

  const client = postgres.getPgClient()
  await client.connect()
  const result = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [config.database])
  await client.end()

  if (result.rowCount === 0) {
    await postgres.createDatabase(config.database)
  }

  console.log(`[local-db] PostgreSQL ready at ${config.url}`)
  return { config, postgres }
}

export function getLocalEnv(config) {
  return {
    ...process.env,
    DATABASE_URL: config.url,
    ADMIN_USERNAME: process.env.ADMIN_USERNAME || 'admin',
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'admin',
    NODE_ENV: process.env.NODE_ENV || 'development',
    SEED_DEMO_DATA: 'true',
  }
}

export async function prepareLocalDatabase(config) {
  const env = getLocalEnv(config)
  const prismaCli = resolve(rootDir, 'node_modules/prisma/build/index.js')
  execFileSync(process.execPath, [prismaCli, 'db', 'push', `--schema=${schemaPath}`, '--skip-generate'], {
    cwd: rootDir,
    env,
    stdio: 'inherit',
  })
  execFileSync(process.execPath, [seedPath], {
    cwd: rootDir,
    env,
    stdio: 'inherit',
  })
  console.log('[local-db] schema and seed data are ready')
  return env
}

async function main() {
  const mode = process.argv[2] || 'setup'
  const { config, postgres } = await startLocalPostgres()
  if (mode === 'setup' || mode === 'prepare') {
    await prepareLocalDatabase(config)
  }
  if (mode === 'prepare') {
    await postgres.stop()
    return
  }

  await new Promise((resolvePromise) => {
    let shuttingDown = false
    const shutdown = async () => {
      if (shuttingDown) return
      shuttingDown = true
      await postgres.stop()
      resolvePromise()
    }
    process.once('SIGINT', shutdown)
    process.once('SIGTERM', shutdown)
    process.stdin.resume()
  })
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    console.error('[local-db] failed:', error)
    process.exitCode = 1
  })
}