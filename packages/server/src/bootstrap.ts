/**
 * 启动引导：自动初始化数据库 + 启动服务
 *
 * 流程：
 * 1. prisma db push（建表）
 * 2. 执行 seed（初始化默认站点和 FAQ）
 * 3. 启动 Express 服务
 *
 * 任何一步失败都不阻塞后续步骤（除了最终的服务启动）
 */

import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { resolve } from 'path'

const prismaSchema = resolve(__dirname, '../prisma/schema.prisma')
const seedFile = resolve(__dirname, '../prisma/seed.js')

// 1. 建表
try {
  console.log('[bootstrap] 正在同步数据库表结构...')
  execSync('npx prisma db push', {
    stdio: 'inherit',
    env: process.env,
    cwd: resolve(__dirname, '..'),
  })
  console.log('[bootstrap] 数据库表结构同步完成')
} catch (e) {
  console.error('[bootstrap] prisma db push 失败，服务仍会继续启动:', (e as Error).message)
}

// 2. 初始化种子数据
if (existsSync(seedFile)) {
  try {
    console.log('[bootstrap] 正在初始化种子数据...')
    execSync(`node "${seedFile}"`, {
      stdio: 'inherit',
      env: process.env,
    })
    console.log('[bootstrap] 种子数据初始化完成')
  } catch (e) {
    console.error('[bootstrap] seed 失败，服务仍会继续启动:', (e as Error).message)
  }
}

// 3. 启动服务（require 确保 bootstrap 进程退出后由 index 接管）
require('./index')
