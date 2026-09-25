# AI Chatbot — 网站客服与线索转化系统

一套可自托管的网站 AI 客服 + 线索转化系统：访客在聊天窗口与 AI 对话（基于 Dify 大模型知识库），AI 无法回答或用户有意向时自动转人工，客服在后台实时接管、回复、跟进线索。

## 功能特性

- **聊天 Widget**：零依赖 Vanilla TS 构建，Shadow DOM 样式隔离，单文件 `widget.js` 一行代码嵌入；支持气泡文案轮播、FAQ 快捷问题、动态问题推荐、可拖动气泡
- **AI 对话**：对接 Dify（Chatflow / Agent / Workflow 均兼容），自动管理会话 ID，失败降级兜底，并发信号量保护
- **线索转化**：多轮对话后触发表单收集（预设字段 + 自定义字段），退出挽留，联系顾问（WhatsApp / 企微二维码）
- **人工接管**：AI 连续无法回答自动转人工；后台实时接管、回复、释放；SSE 实时推送到访客和后台
- **客服后台**：Vue 3 + Pinia + Tailwind，线索管理（状态流转/备注/负责人/CSV 导出）、会话工作台（待处理/已处理、批量操作）、站点配置、FAQ 管理（多语言/拖拽排序）、账号管理（admin/staff 角色）
- **多站点**：单实例服务多个网站，每站点独立 Dify 配置、欢迎语、主题色、表单配置
- **多语言**：Widget 支持中文 / English / 한국어 / Русский，自动识别 + 手动切换 + 宿主语言桥接
- **实时通知**：未读红点、离线消息回放、企微机器人 / n8n webhook 通知
- **生产就绪**：限流、FAQ/站点配置缓存、SSE 连接上限、Redis 跨实例 pub/sub（可选）、健康检查

## 架构

```
浏览器（嵌入 widget.js）
    │  HTTPS
    ▼
Chat API Server（Express + TypeScript + Prisma）
    ├── PostgreSQL（站点 / 会话 / 消息 / 线索 / FAQ / 管理员）
    ├── Dify Chat API（AI 回复，每站点独立配置）
    ├── Redis pub/sub（可选，多实例时跨实例推送；未配置用内存）
    └── 企微机器人 / n8n webhook（线索与转人工通知）

Admin 后台（Vue 3 SPA）── 构建后由 Server 静态托管于 /admin
```

## 目录结构

```
chatbot/
├── packages/
│   ├── server/   # Chat API 后端（Express + Prisma + JWT 认证）
│   ├── widget/   # 聊天窗口 SDK（Vanilla TS + Vite + Shadow DOM）
│   └── admin/    # 客服后台（Vue 3 + Vite + Pinia + Tailwind）
├── n8n/          # n8n 线索通知工作流模板
├── scripts/      # 部署与开发辅助脚本
└── docker-compose.yml
```

## 快速开始（本地开发）

环境要求：Node.js ≥ 20，npm ≥ 10。

```bash
# 1. 安装依赖
npm ci

# 2. 配置环境变量
cp .env.example .env
# 本地开发使用默认值即可启动；Dify Key 留空时 AI 回复走兜底文案

# 3. 启动内嵌 PostgreSQL（127.0.0.1:55432，自动建表 + 写入演示数据）
npm run db:local

# 4. 启动 API 服务
npm run dev:server:local
```

- 后台地址：http://localhost:3001/admin（本地演示账号 `admin` / `admin`，另有 `staff` / `staff`）
- Widget 脚本：http://localhost:3001/widget.js
- 健康检查：http://localhost:3001/api/health

> 本地演示数据包含默认站点、FAQ、一条会话和一条线索，方便直接在后台查看效果。

## 快速开始（Docker 部署）

```bash
git clone <repo-url> && cd chatbot
cp .env.example .env   # 填写 DIFY_API_KEY、JWT_SECRET 等

docker compose up -d   # 启动 PostgreSQL + Redis + Server + n8n
```

服务启动时自动执行 `prisma db push` + 幂等 seed，无需手动初始化数据库。生产环境请务必：

1. 设置强随机的 `JWT_SECRET`（`openssl rand -hex 32`）
2. 修改 `ADMIN_PASSWORD`，首次登录后立即改密
3. 修改 n8n 默认账号密码 `N8N_USER` / `N8N_PASSWORD`

## Widget 嵌入

在目标网站 `</body>` 前加入：

```html
<script
  src="https://your-chatbot-host/widget.js"
  data-site-id="<站点 ID>"
  data-site-key="<站点 API Key>"
  data-api-host="https://your-chatbot-host"
  defer
></script>
```

站点 ID / API Key 在后台「站点配置」中创建和查看。可选属性：`data-lang="en"` 强制指定语言。

宿主网站可动态切换语言：`window.ChatbotWidget.setLanguage('en')` 或派发 `chatbot:language-change` 事件。

## 配置 Dify

1. 在 [Dify](https://dify.ai) 创建应用（Chatflow / Agent / Chat / Workflow 均可），获取 API Key（`app-` 开头）
2. 后台「站点配置」→「AI 配置」：填写 Dify API 地址（支持 API 域名、`/v1` 基础地址或完整 `/v1/chat-messages` 地址）和 API Key
3. 点击「测试连接」验证（服务端请求 Dify `/v1/info`，Key 不会回传前端）

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | PostgreSQL 连接串 | — |
| `PORT` | 服务端口 | `3001` |
| `JWT_SECRET` | JWT 签名密钥，生产必填，缺失拒绝启动 | 开发默认值 |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | 初始管理员账号（仅在不存在时创建） | `admin` / `admin123` |
| `DIFY_API_URL` | Dify API 地址（站点级配置可覆盖） | Dify 官方地址 |
| `DIFY_API_KEY` | Dify API Key（站点级配置可覆盖） | — |
| `DIFY_MAX_CONCURRENT` | 打向 Dify 的并发上限 | `20` |
| `WECOM_WEBHOOK_URL` | 企微机器人 webhook（线索/转人工通知，可选） | — |
| `N8N_WEBHOOK_URL` | n8n 通知 webhook（可选） | — |
| `REDIS_URL` | Redis 连接串（多实例实时推送；未配置用内存） | — |
| `MAX_SSE_CONNECTIONS` | 每实例 SSE 长连接上限 | `500` |
| `CHAT_RATE_LIMIT_*` | 聊天接口限流（每 IP 每分钟） | 见 `.env.example` |
| `RATE_LIMIT_DISABLED` | 设为 `1` 禁用限流（仅压测用） | `0` |

## 常用命令

```bash
npm run dev:server    # 开发服务（需自行准备数据库，配 DATABASE_URL）
npm run dev:widget    # Widget 开发
npm run dev:admin     # 后台开发
npm run build         # 构建 widget → 同步 → admin → 同步 → server
npm test              # 全部工作区测试
npm run test:coverage # 覆盖率
npm run db:local      # 启动内嵌 PostgreSQL（本地演示）
npm run db:push       # 同步 Prisma schema 到 DATABASE_URL
```

## 部署说明

- `scripts/deploy.sh`：全新云服务器一键 Docker 部署（Debian/Ubuntu）
- `scripts/deploy/production-update.sh`：已有 PM2 部署的平滑更新（拉取 → 测试 → 构建 → reload → 健康检查），参数可用环境变量覆盖
- 数据库 schema 变更使用 `prisma db push`（启动时自动执行）；如需严格的迁移历史，建议改用 `prisma migrate` 管理

## 安全须知

- 管理后台 SSE 使用 query 传递 JWT（EventSource 限制），请确保访问日志与 HTTPS 配置可控
- 公开接口（`/api/chat/*`）面向访客，已内置限流与站点归属校验；请勿将后台接口直接暴露到公网未加防护的域名
- 所有密钥（Dify Key、webhook URL、JWT_SECRET）只通过环境变量或后台数据库存储，代码与公开接口不回传

## License

[MIT](./LICENSE)
