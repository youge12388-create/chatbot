# PROJECT_STATE

## 项目目标
网站 AI 客服与线索转化系统。包含 Chat API 后端、Widget 前端聊天窗口、Dify 大模型知识库、PostgreSQL 数据库、n8n 自动化通知。

## 当前进度
- [x] 技术方案设计
- [x] Chat API 后端（Express + TypeScript + Prisma）
- [x] Widget 聊天窗口（Vanilla TS + Vite + Shadow DOM）
- [x] 数据库 Schema（6 表）
- [x] n8n 集成（workflow 文件 + Docker 编排）
- [x] Zeabur GitHub 自动部署链路
- [x] Widget 构建产物自动同步到 Server
- [x] Zeabur 线上部署成功（canhuo.site）
- [x] 数据库自动初始化（bootstrap.ts 启动时建表 + seed）
- [x] Widget 嵌入 luckyboy.me 成功，位置右侧中间
- [ ] 线上 AI 对话端到端验收（Widget → API → Dify）
- [ ] 线上线索提交流程验收（n8n / 企微通知）

## 目录结构
```
chatbot/
├── packages/
│   ├── server/          # Chat API 后端 (Express + Prisma)
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── seed.js
│   │   ├── src/
│   │   │   ├── db/client.ts
│   │   │   ├── routes/chat.ts
│   │   │   ├── services/chat.ts
│   │   │   ├── services/lead.ts
│   │   │   ├── bootstrap.ts   # 启动时自动建表 + seed
│   │   │   └── index.ts
│   │   ├── public/
│   │   │   └── widget.js      # 构建产物，静态提供
│   │   ├── Dockerfile
│   │   └── package.json
│   └── widget/          # 聊天窗口 SDK
│       ├── src/
│       │   ├── widget.ts   # 入口
│       │   ├── ui.ts       # UI 渲染（容器 inline style 定位）
│       │   ├── api.ts      # API 封装
│       │   ├── form.ts     # 线索表单
│       │   └── i18n.ts     # 国际化 (zh-CN/en/ru)
│       ├── dist/widget.js  # 构建产物
│       └── package.json
├── n8n/
│   └── workflow.json       # 线索通知工作流
├── scripts/
│   └── sync-widget.mjs     # Widget 产物同步到 Server
├── docker-compose.yml      # PostgreSQL + Server + n8n
├── .env.example
└── package.json
```

## 数据库表
| 表名 | 用途 |
|------|------|
| Site | 站点配置（域名、API Key、自定义设置） |
| Faq | 预设高频问题 |
| Conversation | 会话（访客、状态、兴趣等级、difyConversationId） |
| Message | 聊天消息 |
| Lead | 用户线索（姓名、电话、意向等） |
| KnowledgeCache | 知识库缓存 |

## API 接口
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/chat/session | 创建会话 |
| POST | /api/chat/message | 发送消息，返回 AI 回复 |
| POST | /api/chat/lead | 提交/更新线索 |
| GET | /api/chat/faqs | 获取预设问题 |
| GET | /api/chat/site?siteKey=xxx | 根据 apiKey 获取站点信息 |
| GET | /api/health | 健康检查 |

## 线上环境
- **域名**: https://canhuo.site
- **部署平台**: Zeabur（GitHub 自动部署）
- **数据库**: Neon PostgreSQL（外部托管，Zeabur 市场 PostgreSQL 因 postgres:18 镜像不存在而不可用）
- **AI 服务**: Dify Chat API
- **默认站点 ID**: cmrgd1bi300008hsqmynz21u9
- **默认 apiKey**: demo-api-key-001
- **Widget 嵌入站点**: luckyboy.me

## Zeabur 环境变量
| 变量名 | 说明 |
|--------|------|
| DATABASE_URL | Neon PostgreSQL 连接串（含 ?sslmode=require） |
| DIFY_API_URL | https://api.dify.ai/v1/chat-messages |
| DIFY_API_KEY | Dify 应用的 API Key（app- 开头） |
| PORT | 3001 |
| WECOM_WEBHOOK_URL | 企微机器人通知（可选） |
| N8N_WEBHOOK_URL | n8n 通知（可选） |

## 最近完成
- 2026-07-09: Chat API 后端完整实现（4 接口 + 6 表）
- 2026-07-09: Widget 聊天窗口完整实现（Shadow DOM + i18n）
- 2026-07-09: n8n 集成（Dockerfile + workflow + docker-compose 编排）
- 2026-07-09: 全面补错误处理、输入校验、Dify 超时与降级
- 2026-07-09: 构建验证通过（server tsc + widget vite）
- 2026-07-09: 新增 `scripts/deploy.sh` 云服务器一键部署脚本
- 2026-07-09: 新增 `packages/server/prisma/seed.js` 默认站点与 FAQ 初始化
- 2026-07-09: 调整 `prisma` 为运行时依赖，支持容器内执行 `prisma db push`
- 2026-07-09: 修复 Zeabur 构建失败 — `build` 脚本改为 `prisma generate && tsc`
- 2026-07-11: 修复 Dify 会话协议：首次请求传空 ID，持久化并复用 Dify 返回的 `conversation_id`
- 2026-07-11: 根目录 `build` 自动构建 Widget、同步到 Server 并构建后端，兼容 Zeabur 自动部署
- 2026-07-11: 移除 n8n workflow 中提交的企微 webhook，改为 `WECOM_WEBHOOK_URL` 环境变量
- 2026-07-11: 新增 Dify 会话请求测试，并修复通知接口不检查 HTTP 状态的问题
- 2026-07-11: 修复 Zeabur 502 — 显式监听 0.0.0.0，根路径返回健康检查兼容网关探针
- 2026-07-11: 修复 widget.js 404 — `.dockerignore` 不再排除 widget.js，Dockerfile 直接 COPY
- 2026-07-11: 新增 `bootstrap.ts`，服务启动时自动 `prisma db push` + `seed`，无需手动进 Shell
- 2026-07-11: 修复 Widget 位置错乱 — 容器定位改用 inline style，不受 Shadow DOM 隔离影响
- 2026-07-11: Zeabur 线上部署成功，数据库初始化成功，Widget 嵌入 luckyboy.me 成功

## 验证结果
- `npm test`: 2 个 Dify 会话测试通过
- `npm run build`: Widget 构建、静态文件同步、Prisma generate、server tsc 全部通过
- 线上 `/api/health`: 返回 `{"status":"ok"}`
- 线上 `/api/chat/site?siteKey=demo-api-key-001`: 返回站点信息，数据库正常
- 线上 `/widget.js`: 200 返回 JS 代码
- Widget 嵌入 luckyboy.me: 按钮出现在右侧中间，位置正确
- AI 对话: 待最终验收（Dify API Key 已配置，需发消息测试）

## 已知问题
- Zeabur 市场 PostgreSQL 不可用（postgres:18 镜像不存在），已改用 Neon 外部数据库
- 已泄露的企微 webhook 仍存在于 Git 历史，必须在企微后台作废并轮换
- 尚未完成线上 Dify 端到端验收（发消息 → AI 回复）
- 尚未完成线索提交 → n8n / 企微通知验收
- `/api/health` 只验证进程存活，不代表数据库、Dify、n8n 都可用

## 下一步
1. **验收 AI 对话**: 在 luckyboy.me 发送消息，确认 Dify 正常回复
2. **验收线索表单**: 发送 3 轮消息后触发表单，提交线索验证入库
3. **验收通知**: 配置 WECOM_WEBHOOK_URL 或 N8N_WEBHOOK_URL，验证通知到达
4. 在企微后台轮换已进入 Git 历史的 webhook key
5. 后续增加数据库 readiness 检查和完整 API 集成测试
6. 考虑增加 Widget 拖动功能（用户有此需求，暂未实现）
