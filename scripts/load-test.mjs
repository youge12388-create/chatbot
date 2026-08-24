/**
 * Local concurrency/load test for the Chat API.
 *
 * Uses a native Node HTTP client (no autocannon) so it runs inside this
 * sandbox. Starts an embedded PostgreSQL and a local server, then drives the
 * public chat endpoints concurrently. The chat message request reuses a known
 * FAQ question so the backend answers from the preset pool and never calls
 * Dify, keeping the test free of external token costs.
 *
 * Options:
 *   LOAD_CONNECTIONS   concurrent connections (default 50)
 *   LOAD_REQUESTS      requests per read endpoint (default 3000)
 *   TEST_DATABASE_URL  use an external database instead of embedded PG
 *
 * Usage: node scripts/load-test.mjs
 */

import { spawn } from 'node:child_process'
import http from 'node:http'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { startLocalPostgres, prepareLocalDatabase, getLocalEnv } from './local-postgres.mjs'

const PORT = 3100
const BASE = `http://127.0.0.1:${PORT}`
const connections = Number(process.env.LOAD_CONNECTIONS || 50)
const readRequests = Number(process.env.LOAD_REQUESTS || 3000)
const writeRequests = Math.max(200, Math.floor(readRequests / 6))
const externalDbUrl = process.env.TEST_DATABASE_URL

let server
let postgres

function percentile(sorted, p) {
  if (sorted.length === 0) return 0
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]
}

function runNative({ method, url, headers, body, totalRequests }) {
  return new Promise((resolve) => {
    const agent = new http.Agent({ keepAlive: true, maxSockets: connections + 20 })
    let sent = 0
    let success = 0
    let failed = 0
    let non2xx = 0
    const latencies = []

    function one() {
      return new Promise((done) => {
        const start = process.hrtime.bigint()
        const req = http.request(url, { agent, method, headers }, (res) => {
          res.resume()
          res.on('end', () => {
            const ms = Number(process.hrtime.bigint() - start) / 1e6
            latencies.push(ms)
            if (res.statusCode >= 200 && res.statusCode < 300) success += 1
            else non2xx += 1
            done()
          })
        })
        req.on('error', () => {
          failed += 1
          done()
        })
        if (body) req.write(body)
        req.end()
      })
    }

    async function worker() {
      while (sent < totalRequests) {
        sent += 1
        await one()
      }
    }

    Promise.all(Array.from({ length: connections }, () => worker())).then(() => {
      latencies.sort((a, b) => a - b)
      agent.destroy()
      resolve({
        sent,
        success,
        failed,
        non2xx,
        p50: percentile(latencies, 0.5),
        p95: percentile(latencies, 0.95),
        p99: percentile(latencies, 0.99),
      })
    })
  })
}

async function waitForHealth(timeoutMs = 30_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/api/health`)
      if (res.ok) return
    } catch {
      // server not up yet
    }
    await delay(300)
  }
  throw new Error('server did not become healthy')
}

async function main() {
  let config
  if (!externalDbUrl) {
    const started = await startLocalPostgres()
    config = started.config
    postgres = started.postgres
    await prepareLocalDatabase(config)
  }

  const serverEntry = fileURLToPath(new URL('../packages/server/dist/index.js', import.meta.url))
  server = spawn(process.execPath, [serverEntry], {
    cwd: fileURLToPath(new URL('../packages/server/', import.meta.url)),
    env: externalDbUrl
      ? { ...process.env, DATABASE_URL: externalDbUrl, PORT: String(PORT), NODE_ENV: 'development', RATE_LIMIT_DISABLED: '1' }
      : { ...getLocalEnv(config), PORT: String(PORT), RATE_LIMIT_DISABLED: '1' },
    stdio: 'inherit',
  })
  server.on('exit', (code) => {
    console.log(`[load-test] server exited (${code})`)
  })

  await waitForHealth()
  console.log(`[load-test] server ready at ${BASE} (connections=${connections})`)

  const siteRes = await fetch(`${BASE}/api/chat/site?siteKey=demo-api-key-001`).then((r) => r.json())
  const siteId = siteRes.data?.id
  if (!siteId) throw new Error('could not resolve default site id')

  const faqRes = await fetch(`${BASE}/api/chat/faqs?siteId=${siteId}&lang=zh-CN`).then((r) => r.json())
  const faqQuestion = faqRes.data?.[0]?.question
  if (!faqQuestion) throw new Error('could not resolve a preset FAQ question')

  const sessionRes = await fetch(`${BASE}/api/chat/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ siteId, visitorId: 'load-test-visitor' }),
  }).then((r) => r.json())
  const conversationId = sessionRes.data?.id
  if (!conversationId) throw new Error('could not create a load-test conversation')

  console.log(`[load-test] siteId=${siteId} conversationId=${conversationId}`)
  console.log(`[load-test] message uses preset FAQ question: "${faqQuestion}"`)

  const jsonHeaders = { 'Content-Type': 'application/json' }
  const targets = [
    { name: 'health', method: 'GET', url: `${BASE}/api/health`, totalRequests: readRequests },
    { name: 'site', method: 'GET', url: `${BASE}/api/chat/site?siteKey=demo-api-key-001`, totalRequests: readRequests },
    { name: 'faqs', method: 'GET', url: `${BASE}/api/chat/faqs?siteId=${siteId}&lang=zh-CN`, totalRequests: readRequests },
    {
      name: 'session',
      method: 'POST',
      url: `${BASE}/api/chat/session`,
      headers: jsonHeaders,
      body: JSON.stringify({ siteId, visitorId: 'load-test-visitor' }),
      totalRequests: writeRequests,
    },
    {
      name: 'message',
      method: 'POST',
      url: `${BASE}/api/chat/message`,
      headers: jsonHeaders,
      body: JSON.stringify({ conversationId, content: faqQuestion, lang: 'zh-CN' }),
      totalRequests: writeRequests,
    },
  ]

  const results = []
  for (const target of targets) {
    process.stdout.write(`[load-test] running ${target.name} (conn=${connections}, req=${target.totalRequests}) ...\n`)
    results.push({ name: target.name, request: target.totalRequests, ...(await runNative(target)) })
  }

  console.log('\n================ LOAD RESULT ================')
  console.log(`connections=${connections}`)
  console.log('endpoint        req     ok   fail  non2xx   p50ms  p95ms  p99ms')
  for (const r of results) {
    console.log(
      `${r.name.padEnd(15)} ${String(r.request).padStart(5)} ${String(r.success).padStart(6)} ` +
      `${String(r.failed).padStart(5)} ${String(r.non2xx).padStart(6)} ${r.p50.toFixed(1).padStart(6)} ` +
      `${r.p95.toFixed(1).padStart(6)} ${r.p99.toFixed(1).padStart(6)}`,
    )
  }
  console.log('=============================================')
}

async function shutdown(code = 0) {
  if (server) {
    server.kill()
    await delay(500)
  }
  if (postgres) {
    await Promise.race([postgres.stop(), delay(3000)])
  }
  process.exitCode = code
  process.exit(code)
}

main()
  .then(() => shutdown(0))
  .catch(async (err) => {
    console.error('[load-test] FAILED:', err)
    await shutdown(1)
  })
