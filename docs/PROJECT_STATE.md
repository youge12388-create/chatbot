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
- [ ] 线上端到端验收（Widget → API → Dify → n8n）

## 目录结构
```
chatbot/
├── packages/
│   ├── server/          # Chat API 后端 (Express + Prisma)
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   ├── src/
│   │   │   ├── db/client.ts
│   │   │   ├── routes/chat.ts
│   │   │   ├── services/chat.ts
│   │   │   ├── services/lead.ts
│   │   │   └── index.ts
│   │   ├── Dockerfile
│   │   └── package.json
│   └── widget/          # 聊天窗口 SDK
│       ├── src/
│       │   ├── widget.ts   # 入口
│       │   ├── ui.ts       # UI 渲染
│       │   ├── api.ts      # API 封装
│       │   ├── form.ts     # 线索表单
│       │   └── i18n.ts     # 国际化 (zh-CN/en/ru)
│       ├── dist/widget.js  # 构建产物
│       └── package.json
├── n8n/
│   └── workflow.json       # 线索通知工作流
├── docker-compose.yml      # PostgreSQL + Server + n8n
├── .env.example
└── package.json
```

## 数据库表
| 表名 | 用途 |
|------|------|
| Site | 站点配置（域名、API Key、自定义设置） |
| Faq | 预设高频问题 |
| Conversation | 会话（访客、状态、兴趣等级） |
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
| GET | /api/health | 健康检查 |

## 最近完成
- 2026-07-09: Chat API 后端完整实现（4 接口 + 6 表）
- 2026-07-09: Widget 聊天窗口完整实现（Shadow DOM + i18n）
- 2026-07-09: n8n 集成（Dockerfile + workflow + docker-compose 编排）
- 2026-07-09: 全面补错误处理、输入校验、Dify 超时与降级
- 2026-07-09: 构建验证通过（server tsc + widget vite）
- 2026-07-09: 新增 `scripts/deploy.sh` 云服务器一键部署脚本
- 2026-07-09: 新增 `packages/server/prisma/seed.js` 默认站点与 FAQ 初始化
- 2026-07-09: 调整 `prisma` 为运行时依赖，支持容器内执行 `prisma db push`
- 2026-07-09: 修复 Zeabur 构建失败 — `build` 脚本改为 `prisma generate && tsc`，消除 npm workspace 中 `@prisma/client` 生成路径与解析路径不一致的问题
- 2026-07-11: 修复 Dify 会话协议：首次请求传空 ID，持久化并复用 Dify 返回的 `conversation_id`
- 2026-07-11: 根目录 `build` 自动构建 Widget、同步到 Server 并构建后端，兼容 Zeabur 自动部署
- 2026-07-11: 移除 n8n workflow 中提交的企微 webhook，改为 `WECOM_WEBHOOK_URL` 环境变量
- 2026-07-11: 新增 Dify 会话请求测试，并修复通知接口不检查 HTTP 状态的问题

## 验证结果
- 2026-07-11 `npm test`: 2 个 Dify 会话测试通过
- 2026-07-11 `npm run build`: Widget 构建、静态文件同步、Prisma generate、server tsc 全部通过
- Widget 构建产物与 Server 对外静态文件 SHA256 一致
- 当前工作树敏感信息扫描未发现企微 webhook key 或 Dify app key
- Docker 镜像构建: 未在云服务器验证（待执行）

## 已知问题
- 已泄露的企微 webhook 仍存在于 Git 历史，必须在企微后台作废并轮换
- Zeabur 环境变量需配置 `DATABASE_URL`、`DIFY_API_URL`、`DIFY_API_KEY`；通知另需 `N8N_WEBHOOK_URL` 或 `WECOM_WEBHOOK_URL`
- 尚未完成线上 Dify 与 n8n 端到端验收
- `/api/health` 只验证进程存活，不代表数据库、Dify、n8n 都可用

## 下一步
1. 在企微后台轮换已经进入 Git 历史的 webhook key，并更新 Zeabur 环境变量
2. 审查改动后推送 GitHub，由 Zeabur 自动部署；无需手工拉取代码
3. 检查 Zeabur 构建日志中 Widget build、静态文件同步、Prisma generate 和 tsc 均成功
4. 线上验证 `/widget.js`、创建会话、连续发送两条 Dify 消息
5. 提交测试线索，验证 n8n 或企微通知
6. 后续增加数据库 readiness 检查和完整 API 集成测试