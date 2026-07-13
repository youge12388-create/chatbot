# PROJECT_STATE

## 项目目标
网站 AI 客服与线索转化系统。包含 Chat API 后端、Widget 前端聊天窗口、Dify 大模型知识库、PostgreSQL 数据库、n8n 自动化通知。

## 当前进度
- [x] 技术方案设计
- [x] Chat API 后端（Express + TypeScript + Prisma）
- [x] Widget 聊天窗口（Vanilla TS + Vite + Shadow DOM）
- [x] 数据库 Schema（7 表，新增 AdminUser）
- [x] n8n 集成（workflow 文件 + Docker 编排）
- [x] Zeabur GitHub 自动部署链路
- [x] Widget 构建产物自动同步到 Server
- [x] Zeabur 线上部署成功（canhuo.site）
- [x] 数据库自动初始化（bootstrap.ts 启动时建表 + seed）
- [x] Widget 嵌入 luckyboy.me 成功，位置右侧中间
- [x] **后台管理系统（Vite + Vue3 + TS + Pinia + Tailwind）**
- [x] **管理员认证（AdminUser 表 + JWT + 多账号 + admin/staff 角色）**
- [x] **线索管理（列表/详情/状态流转/备注/导出 CSV）**
- [x] **会话管理（列表/详情/消息时间线）**
- [x] **人工接管与回复（SSE 实时推送 + taken_over 状态）**
- [x] **站点管理（编辑欢迎语/主题色/气泡文案）**
- [x] **FAQ 管理（增删改查）**
- [x] **账号管理（admin 角色可增删账号）**
- [x] **Widget EventSource 监听后台人工回复**
- [x] **后台实时通知（admin SSE 全局连接 + 顶栏未读红点 + 会话列表高亮 + 站点 webhook 配置）**
- [ ] 线上 AI 对话端到端验收（Widget → API → Dify）
- [ ] 线上线索提交流程验收（n8n / 企微通知）
- [ ] 线上后台端到端验收（登录 → 线索 → 回复 → 配置）

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
| Conversation | 会话（访客、状态、兴趣等级、difyConversationId、lastMessageAt） |
| Message | 聊天消息（source: ai/preset/human/user） |
| Lead | 用户线索（姓名、电话、意向、status、note、assignedTo） |
| KnowledgeCache | 知识库缓存 |
| AdminUser | 管理员账号（username、password bcrypt、role: admin/staff） |

## API 接口
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/chat/session | 创建会话 |
| POST | /api/chat/message | 发送消息，返回 AI 回复（被接管时不调 AI） |
| POST | /api/chat/lead | 提交/更新线索 |
| GET | /api/chat/faqs | 获取预设问题 |
| GET | /api/chat/site?siteKey=xxx | 根据 apiKey 获取站点信息 |
| GET | /api/chat/stream?conversationId=xxx | SSE 长连接，接收后台人工回复 |
| GET | /api/chat/messages?conversationId=xxx&after=ISO | 拉取历史消息（重连拉未读） |
| GET | /api/health | 健康检查 |
| POST | /api/admin/login | 管理员登录 |
| GET | /api/admin/me | 当前用户信息 |
| GET | /api/admin/leads | 线索列表（分页+筛选） |
| GET | /api/admin/leads/:id | 线索详情（含对话） |
| PATCH | /api/admin/leads/:id | 改状态/备注/负责人 |
| GET | /api/admin/leads/export | 导出 CSV |
| GET | /api/admin/conversations | 会话列表 |
| GET | /api/admin/conversations/:id | 会话详情 |
| POST | /api/admin/conversations/:id/reply | 后台人工回复 |
| POST | /api/admin/conversations/:id/takeover | 人工接管 |
| POST | /api/admin/conversations/:id/release | 释放接管 |
| GET | /api/admin/sites | 站点列表 |
| PATCH | /api/admin/sites/:id | 编辑站点 |
| GET | /api/admin/faqs | FAQ 列表 |
| POST | /api/admin/faqs | 新增 FAQ |
| PATCH | /api/admin/faqs/:id | 编辑 FAQ |
| DELETE | /api/admin/faqs/:id | 删除 FAQ |
| GET | /api/admin/users | 账号列表（admin） |
| POST | /api/admin/users | 新增账号（admin） |
| PATCH | /api/admin/users/:id | 改账号（admin） |
| DELETE | /api/admin/users/:id | 删除账号（admin） |

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
| ADMIN_USERNAME | 默认管理员用户名（未配置则 admin） |
| ADMIN_PASSWORD | 默认管理员密码（未配置则 admin123，请尽快修改） |
| JWT_SECRET | JWT 签名密钥（未配置则用开发默认值，生产必须配置） |

## 最近完成
- 2026-07-13: **后台 UI 视觉优化（不触碰核心代码，仅样式层）**
  - 色板升级（style.css）：muted 从 0.55 提到 0.48 满足 4.5:1 对比度；新增 surface-2 / ink-2 / primary-soft / border-strong 变量；tailwind.config.js 同步暴露新色
  - 全局控件语汇（style.css @layer components）：`.btn` / `.btn-primary` / `.btn-danger` / `.btn-ghost` / `.btn-sm` / `.input` / `.select` / `.textarea` / `.table-base` / `.panel` / `.badge`；focus ring 用原生 CSS `color-mix` 实现（Tailwind @apply 对 var() 颜色的透明度修饰符不兼容）
  - Layout.vue：侧边栏改用 surface-2 分层；当前项高亮改 `bg-primary-soft` + 左侧 3px 色条；顶栏 sticky；用户区加圆形头像；登出按钮用 `.btn .btn-sm`；未读徽章加大
  - Pagination.vue：上一页/下一页改 `.btn .btn-sm`，页码加 `tabular-nums`
  - StatusBadge.vue：模板改用 `.badge` 基类
  - EmptyState.vue：图标降为 `text-2xl muted/50`，文案改 `ink-2`，加 `px-4` 内边距
  - Toast.vue：`z-[9999]` → `z-50`（语义化）；加 `ring-1 ring-black/5` 边缘；关闭按钮改为 6x6 命中区带 `hover:bg-white/15`
  - Login.vue：卡片用 `.panel`，输入用 `.input`，按钮用 `.btn .btn-primary`，label 从 muted 改 ink-2
  - Leads.vue / Conversations.vue：筛选栏 select/input/button 改 `.select` / `.input` / `.btn`；表格改 `.table-base` + `.panel` 包裹；骨架屏 `bg-surface` → `bg-surface-2`；数字列加 `tabular-nums`；保留动态 class（hasUnread 高亮、URL query 持久化逻辑）
  - 验证：`npx vue-tsc --noEmit` 零错误；`npm run build` 通过（62 模块，CSS 17.48 kB）
  - 涉及文件：admin src/style.css、tailwind.config.js、components/{Layout,Pagination,StatusBadge,EmptyState,Toast}.vue、views/{Login,Leads,Conversations}.vue
- 2026-07-13: **自定义表单收集功能（admin + widget 全链路）**
  - 后端已就绪：`DEFAULT_SITE_SETTINGS.formConfig`、`mergeSettings` 兜底、`upsertLead` 解构 extra 合并到 lead.extra、admin PATCH 透传 settings，无需改动
  - admin `types.ts`：新增 `CustomFieldType` / `CustomField` / `FormConfig` 类型，`SiteSettings.formConfig` 可选字段
  - admin `Sites.vue`：站点编辑表单加"表单配置"区，预设字段表格样式（启用/必填 checkbox，关闭启用时同步关闭必填），自定义字段堆叠卡片样式（label/type/options/required，select 类型才显示选项输入），自定义字段 id 用 `f_` + 随机串；旧数据用 `ensureFormConfig` 兜底
  - widget `api.ts`：`SiteSettings.formConfig` 字段；`submitLead` 增加 `extra?: Record<string,string>` 参数，有内容才写入 body
  - widget `form.ts`：完全重写为按 formConfig 动态渲染。`PRESET_FIELDS` 常量数组（按固定顺序，多语言 label/placeholder），`normalizeFormConfig` 兜底；预设字段值进 onSubmit 第一参（顶层字段），自定义字段值进第二参 extra；textarea/select 用 DOM API 创建；保留原有错误提示/校验/样式
  - widget `ui.ts`：`openForm` 透传 `siteSettings?.formConfig`，回调改为 `(data, extra) => api.submitLead(data, extra)`
  - admin `LeadDetail.vue`：基本信息卡下方加"自定义信息"区，`v-if="lead.extra && Object.keys(...).length>0"`，遍历 `lead.extra` 显示 key-value，`formatExtraValue` 处理 unknown 类型转字符串
  - 验证：`npx vue-tsc --noEmit` 零错误；`npx vite build` 通过（22.43 kB）
  - 涉及文件：admin src/types.ts、views/Sites.vue、views/LeadDetail.vue；widget src/api.ts、src/form.ts、src/ui.ts
- 2026-07-13: **后台实时通知与 webhook 配置（admin 前端）**
  - 新增 `adminSseUrl()`（client.ts）：后台 SSE 端点 `/api/admin/stream?token=xxx`，JWT 拼到 query（EventSource 不支持自定义头）
  - 新增 `stores/notification.ts`：单一 admin SSE 连接管理未读数 + 最近 50 条客户消息；`connect()` 幂等，`onmessage` 解析 `{event,data}`，`user_message` 累加未读并入栈，`agent_reply` 单独入栈（供详情页实时追加）
  - Layout 顶栏加未读红点徽标（danger 色，99+ 封顶，点击跳 /conversations）；onMounted 调 `connect()`，**不在 onUnmounted 断开**（Layout 为 per-view，断开会违反"页面切换 SSE 不断开"，logout 全页刷新自然销毁）
  - ConversationDetail 改为复用 store 连接（watch latestMessages/latestAgentReplies 按 id 去重追加），移除独立 EventSource
  - Conversations 订阅 latestMessages 做行高亮（bg-accent/10），点击详情调 `markConversationRead` 清除高亮
  - Sites 编辑表单加 `webhookUrl` / `n8nWebhookUrl` 两个 text input，随 settings 一起 PATCH
  - 类型补全：`SiteSettings` 加 webhookUrl/n8nWebhookUrl；`MessageSource` 补 `'user'`（后端用户消息 source 即 'user'，前端类型原本缺失）
  - 验证：`npx vue-tsc --noEmit` 零错误
  - 涉及文件：admin src/api/client.ts、stores/notification.ts(新)、components/Layout.vue、views/ConversationDetail.vue、views/Conversations.vue、views/Sites.vue、types.ts
- 2026-07-13: **Widget 气泡提示升级**
  - 气泡文案字段从单条 `bubbleMessage: string` 改为多条 `bubbleMessages: string[]`，后台可配置轮播
  - 气泡样式增强：主题色背景 + 白字 + 阴影 + 淡入淡出，背景与箭头跟随主题色
  - 气泡改为常驻显示（不再 3 秒自动消失），多条文案每 5 秒轮播切换
  - 打开聊天窗口时隐藏气泡，关闭窗口后重新出现
  - 后端 `mergeSettings` 兼容旧 `bubbleMessage` 字符串字段，自动转数组并清理
  - admin 站点编辑：单行 input 改为 textarea（每行一条文案）
  - 涉及文件：widget ui.ts/api.ts、server chat.ts/seed.js、admin types.ts/Sites.vue
- 2026-07-12: **后台管理系统完整实现**
  - 新增 AdminUser 表，Lead 加 status/note/assignedTo，Conversation 加 lastMessageAt
  - 认证：JWT + bcrypt + admin/staff 角色 + 中间件
  - 线索：列表/详情/状态流转/备注/导出CSV
  - 会话：列表/详情/消息时间线
  - 人工接管：SSE pub/sub + taken_over 状态 + 后台回复推送到 widget
  - 站点/FAQ/账号管理：增删改查
  - Widget EventSource 监听 + 重连拉未读
  - 构建链路：admin build → sync → server，Dockerfile 更新
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
- **后端 admin SSE 当前只推 `user_message`，未推 `agent_reply`**：`chat.ts` 的 `publishAdmin` 只发 user_message；`agent_reply` 仅经 `publish()` 推到 widget 通道（admin.ts:283）。因此 ConversationDetail 的 agent_reply 实时追加分支目前不会触发（前端已防御性实现，后端补 `publishAdmin({event:'agent_reply',...})` 后即生效；自身回复已由 sendReply 本地追加，不影响使用）
- Zeabur 市场 PostgreSQL 不可用（postgres:18 镜像不存在），已改用 Neon 外部数据库
- 已泄露的企微 webhook 仍存在于 Git 历史，必须在企微后台作废并轮换
- 尚未完成线上 Dify 端到端验收（发消息 → AI 回复）
- 尚未完成线索提交 → n8n / 企微通知验收
- `/api/health` 只验证进程存活，不代表数据库、Dify、n8n 都可用

## 下一步
1. **验收 AI 对话**: 在 luckyboy.me 发送消息，确认 Dify 正常回复
2. **验收线索表单**: 发送 3 轮消息后触发表单，提交线索验证入库
3. **验收通知**: 配置 WECOM_WEBHOOK_URL 或 N8N_WEBHOOK_URL，验证通知到达
4. **验收后台**: 访问 /admin，用 admin/admin123 登录，查看线索/会话，测试人工回复
5. **生产配置**: 在 Zeabur 配置 ADMIN_PASSWORD 和 JWT_SECRET，改默认密码
6. 在企微后台轮换已进入 Git 历史的 webhook key
7. 后续增加数据库 readiness 检查和完整 API 集成测试
8. 考虑增加 Widget 拖动功能（用户有此需求，暂未实现）
