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
| POST | /api/admin/sites/:id/test-dify | 使用站点已保存配置测试 Dify 连接（不返回 Key） |
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

- 2026-07-14: **后台工作台重设计 + 多站点 Dify Agent 修复**
  - 后台按白底、冷灰、深蓝的 Swiss 工作台方向重做：站点上下文侧栏、顶部站点信息、统一筛选面板、表格卡片、SVG 图标与空状态；站点选择在各业务页保持一致。
  - 根因：Dify Agent / Agent Chat 只支持 streaming，原服务端固定发送 blocking，导致请求返回 400；现改为解析 SSE 的 `message` / `agent_message` 事件并保存 Dify 会话 ID。
  - 每次聊天按会话所属 siteId 读取该站点的 Dify URL 和 Key；旧 Dify 会话失效时自动重建，不再因未知 siteId 隐式创建无配置站点。
  - Widget 创建会话同时提交 siteKey；同时校验 siteId/siteKey，避免站点配置串用。
  - `/api/chat/site` 与会话初始化只返回公开配置白名单，Dify Key、API 地址和 Webhook 不再暴露给访客。
  - 站点配置新增“保存后测试连接”：服务端请求 Dify `/v1/info`，前端只接收应用名称和模式，不接收 Key。
  - 验证：`npm test` 14/14 通过；server/admin/widget 构建通过；tracked diff 敏感模式扫描未发现真实 Dify Key。
- 2026-07-14: **Dify 智能体切换兼容修复**
  - Dify API 地址支持填写 API 域名、`/v1` 基础地址或完整 `/v1/chat-messages` 地址，服务端统一规范化。
  - 站点更换 Dify 智能体后，若旧 `conversation_id` 已失效，自动创建新会话并保存新的会话 ID。
  - 后台明确提示不能填写智能体访问页面链接；不修改或输出已有 API Key。
  - 回归测试覆盖地址补全、旧会话重建判定和非会话错误不重试。
  - 验证：`npm test` 12/12 通过；`npm run build:server`、`npm run build:admin`、`git diff --check` 通过。
- 2026-07-13: **默认站点 FAQ 作为空站点的可配置兜底**
  - 线上核验：`luckyboy.me` Widget 使用 `cmrgdlbi300008hsqmynz2lu9`（后台“站点 nz2lu9”），该站点无 FAQ；后台修改发生在默认站点 `cmrgd1bi300008hsqmynz21u9`
  - 修复：FAQ 统一按“当前站点配置 → 默认站点配置 → 代码兜底”读取，覆盖初始按钮、动态推荐和点击答案
  - 回归测试：覆盖“空站点继承默认 FAQ”和“当前站点自定义 FAQ 优先”
  - 验证：`npm test` 6/6 通过；`npm run build:server` 通过；`git diff --check` 通过
  - 涉及文件：server `src/services/chat.ts`、`src/services/chat.test.ts`
- 2026-07-13: **修复后台 FAQ 答案被服务启动覆盖**
  - 根因：`bootstrap.ts` 每次启动执行 `seed.js`，原 seed 会先删除默认站点全部 FAQ，再重建默认答案
  - 修复：seed 改为幂等初始化；站点已有 FAQ 时完整保留，仅 FAQ 为零时创建 3 条默认数据
  - 回归测试：覆盖“已有 FAQ 不写入”和“空库写入默认 FAQ”两条路径
  - 验证：`npm test` 4/4 通过；`npm run build:server` 通过；`git diff --check` 通过
  - 涉及文件：server `prisma/seed.js`、`src/seed.test.ts`
- 2026-07-13: **FAQ 点击仍走 AI 修复 + 气泡按钮自由拖动**
  - 问题 1：站点无 FAQ 记录时点击 3 个默认问题仍显示"思考中"。根因：`getFaqs` 有 `DEFAULT_FAQS` 兜底所以按钮能显示，但 `findFaqAnswer` 只查数据库，空数据返回 null → 走 AI
  - 修复：`findFaqAnswer` 加 `const pool = faqs.length > 0 ? faqs : DEFAULT_FAQS` 兜底，并改为精确匹配优先 + 双向模糊匹配兜底
  - 问题 2：气泡按钮不能自由拖动
  - 修复：widget `ui.ts` 加 mouse + touch 拖动逻辑（5px 阈值判定拖动 vs 点击，越阈值后切 fixed 定位并移动，边界限制在视口内），捕获阶段阻止拖动后的 click 触发 toggle
  - 附带：气泡方向自适应（按钮在左半屏时气泡显示在右侧，箭头朝左）
  - 涉及文件：server chat.ts、widget ui.ts
  - 后续修复：聊天窗口改为固定 60×60 容器内的绝对定位，打开时按视口边界钳制，避免拖动后窗口从页面右侧溢出
- 2026-07-13: **引流转化升级：底部抽屉表单 + 联系顾问 + 退出挽留**
  - 表单改底部抽屉滑出（不遮挡对话，带滑入动画和拖动条）
  - 表单字段精简：姓名 + 电话 + 申请学历层次（下拉：本科/硕士/博士/预科/语言班），其他默认关闭
  - 聊天窗口头部加"联系顾问"按钮（常驻），点击弹卡片让用户选 WhatsApp 或企微二维码
  - 联系方式配置加到 siteSettings：contactWhatsApp / contactWecomQrUrl，后台可编辑，留空不显示按钮
  - 退出挽留：点关闭按钮先弹挽留卡片（仅聊天窗口内，不拦截浏览器），只要手机号，提交后入库为线索
  - 挽留卡片每个会话只触发一次，用户可选"仍要关闭"真关
  - 涉及文件：widget ui.ts/form.ts/api.ts、server chat.ts/seed.js、admin types.ts/Sites.vue
- 2026-07-13: **FAQ 动态推荐 + 空数据兜底**
  - 问题 1：站点无 FAQ 数据时按钮区域空白 → 后端 `getFaqs` 空时返回 `DEFAULT_FAQS` 3 条通用问题
  - 问题 2：FAQ 不会随用户问题更新 → `/api/chat/message` 返回 `suggestedQuestions`
  - 后端新增 `getSuggestedQuestions(siteId, content, excludeQuestions)`：关键词匹配 + 排除已问过的
  - widget `renderFaqs(questions)` 抽函数，sendMessage 后动态更新 FAQ 区域
  - 涉及文件：server chat.ts/routes chat.ts、widget api.ts/ui.ts
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
- `npm test`: 14/14 通过（含 Dify streaming、公开配置脱敏、URL 规范化、FAQ 回退、seed 与域名校验）
- `npm run build`: Widget 构建、静态文件同步、Prisma generate、server tsc 全部通过
- 线上 `/api/health`: 返回 `{"status":"ok"}`
- 线上 `/api/chat/site?siteKey=demo-api-key-001`: 返回站点信息，数据库正常
- 线上 `/widget.js`: 200 返回 JS 代码
- Widget 嵌入 luckyboy.me: 按钮出现在右侧中间，位置正确
- AI 对话: 待最终验收（Dify API Key 已配置，需发消息测试）

## 已知问题
- 当前线上版本在部署本次修复前，公开站点配置接口会返回完整 settings，Dify Key 可能已暴露；部署后必须轮换受影响站点的 Dify Key，并用新“测试连接”复验。
- `luckyboy.me` 当前 Widget `data-site-id` 指向自动创建的“站点 nz2lu9”，不是默认站点；FAQ 已通过默认站点回退兼容，但仍建议后续把嵌入 ID 改为默认站点 ID，避免配置继续分裂
- Zeabur 市场 PostgreSQL 不可用（postgres:18 镜像不存在），已改用 Neon 外部数据库
- 已泄露的企微 webhook 仍存在于 Git 历史，必须在企微后台作废并轮换
- 尚未完成线上 Dify 端到端验收（发消息 → AI 回复）
- 尚未完成线索提交 → n8n / 企微通知验收
- `/api/health` 只验证进程存活，不代表数据库、Dify、n8n 都可用

## 2026-07-14 后台站点上下文改造
- 左上角新增全局站点切换器，固定显示当前站点名称和可点击网址；选择结果保存在本地，页面切换后保持。
- 线索、会话、FAQ、站点配置统一读取全局 `siteId`，切换站点后自动刷新当前页面；账号管理仍是全局数据。
- 线索和会话列表、线索详情、会话详情明确展示来源站点名称及网址，避免跨站点消息混淆。
- 后端线索列表和 CSV 导出支持 `siteId` 过滤，并返回站点信息；修复 `/leads/export` 被 `/leads/:id` 截获的问题。
- admin SSE 的 `user_message` / `agent_reply` 均携带 `siteId`，未读消息按当前站点统计。
- 后台视觉统一为 Swiss 信息界面：白/中性灰网格、Yves Klein Blue 单一主强调色、左对齐信息层级。

### 关键文件
- `packages/admin/src/stores/site.ts`
- `packages/admin/src/components/Layout.vue`
- `packages/admin/src/views/{Leads,Conversations,Faqs,Sites}.vue`
- `packages/server/src/routes/{admin,chat}.ts`

### 最近验证
- `npx vue-tsc --noEmit`：通过。

## 下一步
1. **验收 AI 对话**: 在 luckyboy.me 发送消息，确认 Dify 正常回复
2. **验收线索表单**: 发送 3 轮消息后触发表单，提交线索验证入库
3. **验收通知**: 配置 WECOM_WEBHOOK_URL 或 N8N_WEBHOOK_URL，验证通知到达
4. **验收后台**: 访问 /admin，用 admin/admin123 登录，查看线索/会话，测试人工回复
5. **生产配置**: 在 Zeabur 配置 ADMIN_PASSWORD 和 JWT_SECRET，改默认密码
6. 在企微后台轮换已进入 Git 历史的 webhook key
7. 后续增加数据库 readiness 检查和完整 API 集成测试
8. ~~考虑增加 Widget 拖动功能~~（已完成，2026-07-13）

## 2026-07-14 Zeabur 构建修复
- 根目录与 server Dockerfile 的依赖安装统一改为 `npm ci --ignore-scripts`，避免第三方 postinstall 在云构建阶段异常退出。
- Prisma Client 仍由后续根构建中的 `npm run build:server` → `prisma generate` 显式生成，不改变运行时依赖。
- 隔离验证：npm 10.8.2 全新安装 239 个包成功；Widget、Admin、Server 完整生产构建通过。

## 2026-07-14 后台站点网址与切换器修复
- 根因：聊天服务自动创建站点时用站点 ID 临时占位 `domain`；旧后台未校验，直接把该值渲染成网址，形成类似 `cmrgdlbi...` 的错误外链。
- 后台现在只把有效域名显示为可点击网址；ID 型占位值统一显示“未配置网址”。
- 左上角原生下拉框改为两行站点切换器，分别展示站点名称和网址状态；长名称自动截断，选中项独立高亮。
- 站点配置页支持填写真实网站域名；服务端只接受 HTTP(S) 网站域名或本地开发地址，拒绝路径、账号信息和随机 ID。
- 线索、会话、详情和 FAQ 页面统一复用网址校验，不再生成无效链接。
- 兼容说明：未自动修改历史数据库记录；管理员可在“站点配置”中填写 `luckyboy.me` 后保存。

### 最近验证
- `npm run build:admin`：通过（Vue 类型检查 + Vite 生产构建）。
- `npm run build:server`：通过（Prisma Client 生成 + TypeScript 编译）。
- 网址识别与域名规范化测试：7/7 通过。
- `git diff --check`：通过。
- 本地浏览器已能打开登录页；因当前环境未配置 `DATABASE_URL`，无法登录进入数据页完成截图验收。
## 2026-07-16 后台侧边栏线上资源核验
- 源码已改为固定两列 CSS Grid：展开侧栏 304px、收起侧栏 86px，右侧使用 `minmax(0, 1fr)`，并限制页面整体高度与溢出滚动。
- 本地 `npm run build:admin` 已通过，生成新资源 `index-DTKrHFMa.css`。
- 线上 `https://canhuo.site/admin/index.html` 仍加载旧资源 `index-DqxtYjCA.css` / `index-F-Qpitj1.js`；`packages/server/public/admin` 是构建产物且被 `.gitignore` 排除，需要 Zeabur 重新构建发布后才会生效。

## 2026-07-16 会话接管与企业微信通知问题核验
- 后台会话当前把 `active`、`taken_over`、`transferred`、`closed` 直接暴露给客服，但列表缺少“待接管”任务队列、负责人、触发原因和下一步动作，新客服无法快速判断该做什么。
- 会话详情页把“接管”和“回复”拆成两个弱按钮，没有明确提示接管后 AI 已暂停，也没有把接管、回复、结束组织成任务流。
- 人工通知链路存在可靠性问题：`packages/server/src/routes/chat.ts` 以 `catch(() => {})` 静默吞掉通知失败；`notifyTransfer` 在 n8n 返回成功时直接 `return`，因此不会继续发送企业微信；`postJson` 只检查 HTTP 状态，不检查企业微信响应体的 `errcode`。
- 当前人工通知仅在关键词路由命中时触发，AI 连续两次无法回答尚未形成可观测、可配置的转人工任务机制。
## 2026-07-16 会话工作台状态流调整
- 客户触发人工后会话状态改为 `transferred`（待人工），客服点击“接管并回复”后才进入 `taken_over`（人工处理中）；待人工状态下 AI 仍保持暂停。
- 会话列表新增工作台引导和状态快捷筛选；详情页新增“客户已请求人工客服”提示，待人工时禁用回复框，避免新人绕过接管流程。
- 后台人工回复接口会把 `transferred` 自动接管为 `taken_over`，保持旧客服操作兼容。
## 2026-07-16 AI 无法回答自动转人工
- `chatService` 会在会话 metadata 中记录 `aiNoAnswerCount`；AI 连续两次返回明确的无法回答/服务不可用文案后，自动转为 `transferred`，并复用企业微信转人工通知。
- 一次正常回答或 FAQ 预设答案会把计数清零；无需数据库迁移。

## 2026-07-16 会话列表按最近消息排序
- 后台会话接口按 `lastMessageAt`、`updatedAt`、`createdAt` 倒序返回，确保最近有消息的会话排在前面。
- 保存消息时只允许更晚的时间覆盖 `lastMessageAt`，避免并发请求造成顺序倒置。
- 前端列表增加时间兜底排序，并收到新客户消息后立即将对应会话置顶。
## 2026-07-16 会话状态改为待处理与已处理
- 后台不再显示“已超时”，`active`、`taken_over`、`transferred` 统一展示为“待处理”，`closed` 展示为“已处理”。
- 列表原有筛选结构保持不变，仅将会话状态文案统一为“待处理 / 已处理”。
- 会话详情增加“标记已处理”按钮，通过后台接口写入 `closed` 和 `closedAt`。

## 2026-07-16 铃铛通知交互修复
- 顶部铃铛点击后会清除当前站点的未读客户消息提醒，并跳转到会话总览；即使已经在会话页，也会重置状态筛选和分页，避免点击无可见反馈。
- 通知 store 新增 `markSiteRead(siteId)`，只清理当前站点，不影响其他站点的提醒。

## 2026-07-16 会话列表补充初始时间
- 会话列表在“最后消息时间”旁新增“初始时间”，直接展示会话 `createdAt`；排序仍按最后消息时间优先。

## 2026-07-16 客服工作台第一轮优化
- 会话列表接口附带每个会话最后一条消息，列表显示客户最后一句话预览。
- 状态列补充处理原因和待人工等待时长；操作按钮根据状态显示“打开处理 / 继续处理 / 查看”。
- 标记已处理增加确认提示，并新增“重新打开”接口和按钮，支持误操作恢复。

## 2026-07-16 多客服接管、负责人和批量处理
- `Conversation` 新增可为空的 `assigneeId`，管理员可在会话详情指定负责人；首次接管且未分配时自动记录当前客服为负责人。
- 接管不做互斥锁，允许多名客服同时进入同一会话处理；负责人仅作为主要跟进人展示，不阻止其他客服回复。
- 管理员可批量标记会话已处理，前端和服务端都限制最多 100 条；前端必须二次确认。
- 管理员专属操作：分配负责人、批量处理、重新打开已处理会话；普通客服保留接管、回复和单条处理权限。
- 线上数据库需要执行 Prisma schema 同步后，负责人字段才会生效；本次未执行生产数据库变更。

## 2026-07-16 Widget 多语言第一阶段
- Widget 支持中文、英文、韩文、俄文，按 `data-lang`、页面 `lang`、浏览器语言自动识别，并把语言带入会话、FAQ 请求和表单字段渲染。
- 站点欢迎语、引导语、气泡文案和自定义表单字段支持按语言存储；旧的纯字符串/数组配置继续兼容。
- FAQ 增加 `language` 字段，读取顺序为请求语言、中文、默认站点对应语言、默认站点中文、代码兜底；后台 FAQ 支持选择语言。
- Dify 请求体暂未改动，按当前任务约定留到下一阶段。数据库需在部署前执行 Prisma schema 同步，本次未执行数据库变更。

### 最近验证
- `npm run build -w packages/server`：通过。
- `npm test -w packages/server`：18/18 通过。
- `npm run build -w packages/widget`：通过。
- `npm run build -w packages/admin`：通过。
- `git diff --check`：通过。

## 2026-07-17 后台新增站点
- 新增 `POST /api/admin/sites`，仅管理员可创建站点；服务端校验名称和域名，并生成随机 Site API Key。
- 后台站点配置页新增“新增站点”表单；创建成功后自动切换到新站点，并展示可复制的 Site ID/API Key。
- 新网站使用对应 `data-site-id` 和 `data-site-key` 后，会自动归档到该站点；不会根据域名隐式创建站点。

### 最近验证
- `npm run build -w packages/server`：通过。
- `npm test -w packages/server`：19/19 通过。
- `npm run build -w packages/admin`：通过。
- `git diff --check`：通过。
## 2026-07-17 FAQ 展示与答案格式修复
- Widget FAQ 按钮最多展示 5 条；后台 FAQ 仍可自由增删改，后端接口未增加数量限制。
- 后台新增和编辑 FAQ 的答案改为多行输入；Widget 回复渲染保留换行与空行段落。
- 本次未执行数据库变更。

### 最近验证
- `npm run build -w packages/widget`：通过。
- `npm run build -w packages/admin`：通过。
- `npm test -w packages/server`：19/19 通过。
- `git diff --check`：通过。

## 2026-07-17 后台二维码缩略图可编辑
- 站点配置支持直接上传 PNG/JPG/WebP 二维码并在保存前预览，也保留公网图片 URL 输入方式。
- 上传图片限制 256KB，保存到站点设置后由聊天窗口直接展示；服务端 JSON 请求体上限调整为 512KB。

## 2026-07-17 FAQ 排序与站点文案编辑优化
- 后台 FAQ 按语言筛选，支持拖拽排序和将问题置顶；当前语言前 5 条作为 Widget 快捷问题展示。
- 新增 POST /api/admin/faqs/reorder，按站点和语言原子保存 FAQ 展示顺序。
- 站点欢迎语、引导语和气泡文案改为语言下拉选择后编辑，保留原有多语言数据结构。
- 本次未执行数据库迁移。

### 最近验证
- npm test：20/20 通过。
- npm run build:admin：通过。
- npm run build:widget：通过。
- npm run build:server：通过。
- git diff --check：通过。


## 2026-07-20 Conversation triage and notification panel
- Admin conversation list now queries only conversations with at least one message. Empty session records remain in the database and reappear automatically after the first customer message.
- The admin bell opens an unread-message panel scoped to the selected site; clicking a notification marks that conversation read and opens its detail page.
- Real-time customer messages refresh the conversation list when they belong to a previously hidden empty session.
- Visitor labels use the lead name/phone when available, otherwise a stable four-character visitor suffix. Conversation detail aligns visitor messages left and operator/AI messages right.

### Validation
- npm run build:admin passed.
- npm run build:server passed.
- npm test -w packages/server passed (20/20).
- git diff --check passed.


## 2026-07-20 Offline notification replay
- Added GET /api/admin/notifications?siteId=&since= so the admin can replay customer messages created while the browser was closed or disconnected.
- Notification state now persists pending messages and read message ids in localStorage, deduplicates SSE plus replay responses, and syncs the selected site on startup and site changes.
- The last sync cursor advances only after a successful replay request; failed requests retry on the next open.
- Validation: admin build, server build, server tests (21/21), and git diff --check passed.


## 2026-07-20 Sequential visitor labels and expanded site settings
- Conversation APIs return a per-site sequential visitor number based on the visitorId first seen in a non-empty conversation; the admin displays it as visitor 001, visitor 002, and keeps the same label for the same visitor across sessions.
- Site configuration cards default to expanded on first load while preserving a manually collapsed state during refreshes.
- The raw visitorId remains an internal identifier and is not shown in the admin UI.

## 2026-07-20 跨域站点会话归属修复
- 根因：`check.medicalchinaway.com` 与 `114.132.180.195` 的线上页面都注入了同一个 `data-site-id`，且未提供 `data-site-key`；服务端原先只按该 ID 创建会话，没有校验页面来源域名。
- 修复：会话创建读取浏览器 `Origin`，当 Origin 命中已配置的 `Site.domain` 时，优先将新会话写入该站点；显式 `siteKey` 仍按原逻辑严格校验，不静默改站点。
- 部署前提：后台“站点配置”中必须存在并准确填写 `check.medicalchinaway.com` 与 `114.132.180.195` 两个站点域名；历史上已错误归档的会话不会自动迁移。
- 涉及文件：`packages/server/src/routes/chat.ts`、`packages/server/src/services/chat.ts`、`packages/server/src/utils/site-domain.ts`。
- 验证：`npm run build -w packages/server`、`npm test -w packages/server`（23/23）、`git diff --check` 均通过。

## 2026-07-20 站点删除功能
- 管理后台“站点配置”新增管理员专用“删除站点”按钮，带二次确认。
- 服务端新增 `DELETE /api/admin/sites/:id`；删除时事务级联清理该站点的 FAQ、线索、消息和会话。
- 为避免误删，系统不允许删除最后一个站点；非管理员无法调用删除接口。
- 验证：`npm test`（24/24）、`npm run build:admin`、`npm run build:server`、`git diff --check` 均通过。
## 2026-07-20 站点身份字段编辑
- 管理后台站点配置新增 Site ID 与 Site API Key 编辑框；普通员工仍只能修改名称、域名和公开/业务配置，身份字段仅管理员可改。
- 服务端 PATCH /api/admin/sites/:id 支持修改 id/apiKey，并校验 Site ID 格式、API Key 长度和唯一性。
- 修改 Site ID 时使用事务创建临时站点、迁移 FAQ 与会话关联、删除旧站点并写入最终配置；修改后必须同步网站代码中的 data-site-id/data-site-key。
- 验证：npm test（25/25）、npm run build:admin、npm run build:server、git diff --check 均通过。
## 2026-07-21 通知红点刷新状态修复
- 通知 store 从 localStorage 恢复待处理消息时，会再次排除已记录为已读的消息。
- 打开会话详情或标记会话已处理时，同步清理该会话的通知状态。
- 离线通知回放接口返回会话状态；前端会清理旧缓存中已经关闭的会话，避免刷新后重新出现红点，同时不丢失关闭后产生的新消息。
- 验证：npm test（25/25）、npm run build:admin、npm run build:server、git diff --check 均通过。
## 2026-07-21 Test coverage integration
- Root `npm test` now runs test scripts for admin, server, and widget workspaces.
- Root `npm run test:coverage` uses Node's built-in test coverage and includes all three workspace test globs.
- Admin tests are connected through `packages/admin/package.json`; widget now covers i18n fallback/normalization and ChatApi request/session/replay behavior.
- Validation: 60 tests passed; line coverage 83.00%, branch coverage 82.59%, function coverage 86.48%; admin/widget/server builds passed.

## 2026-07-21 Widget 手动语言切换
- 聊天窗口标题栏新增语言下拉框，支持中文、English、한국어、Русский手动切换。
- 切换后同步更新固定 UI 文案、欢迎语、引导语、气泡文案和 FAQ；后续消息请求使用新语言。
- 新增 Widget API 语言切换回归测试；本次未执行数据库变更。

## 2026-07-21 Localized site copy migration
- The admin Sites settings already expose language-specific editors for welcome, guide, and bubble copy; legacy string/array values are now normalized into `zh-CN` fields when drafts load, so the next site save persists the localized shape.
- The server normalizes legacy welcome/guide strings and bubble arrays before returning public Widget settings. Existing localized values are preserved and invalid/empty values still use the configured defaults.
- No database migration was executed; settings remain JSON and migration is backward-compatible at read/save boundaries.
- Validation: admin tests 8/8, server tests 47/47, admin type-check/build passed, server build passed, and `git diff --check` passed.

## 2026-07-21 Widget 宿主语言同步
- Widget 继续支持内部语言下拉；新增宿主语言桥接。
- 未显式设置 data-lang 时，Widget 监听 document.documentElement.lang 变化并自动切换。
- 宿主网站若不修改 html lang，可调用 window.ChatbotWidget.setLanguage('en')，或派发 chatbot:language-change 事件（detail: { lang: 'en' }）。
- 兼容 US/UK/GB -> English、KR -> Korean 等常见站点语言/地区代码。
- Widget 源码测试 9/9、生产构建通过；本次未执行数据库变更。

## 2026-07-22 气泡文案换行修复
- 后台多语言气泡文案编辑时保留末尾空行，按 Enter 后可以继续输入下一行；保存和服务端仍会清理空白行。

## 2026-07-22 Admin site configuration visual grouping
- Refactored the expanded site settings view into bordered sections for identity, multilingual copy, contact and notifications, AI configuration, and form configuration.
- Preserved existing save, delete, copy, QR upload, webhook, Dify, FAQ, and form configuration behavior.
- 验证：npm test（64/64）、npm run build:admin、admin 静态文件同步、git diff --check 均通过。

## 2026-07-22 Mobile admin UI
- 按移动端参考图优化管理后台：680px 以下隐藏侧边栏，新增站点选择器与固定底部四项导航。
- 线索、会话、FAQ、账号表格在移动端转换为单列卡片；站点配置保持分组卡片并压缩间距。
- 未修改业务接口、权限和桌面端布局。
- 验证：admin 测试 8/8、vue-tsc + vite build、git diff --check 均通过。


## 2026-07-22 Mobile pixel UI
- 按四张参考图重做移动端线索、会话、FAQ 和站点配置页面的专用卡片模板与布局。
- 仅复用已有接口字段和操作；会话页不添加收藏、评论等图片中但产品未提供的功能。
- 验证：admin 测试 8/8、vue-tsc + vite build、git diff --check 均通过。


## 2026-07-22 Mobile bottom navigation render fix
- Layout now renders the four mobile route buttons for leads, conversations, FAQ, and site configuration; the existing mobile navigation CSS is reused.
- Validation: admin tests 8/8, admin build, and git diff --check passed.
## 2026-07-22 线索表单保存修复
- 根因：默认表单提交 `applyingLevel`，但 Lead 数据模型没有该列；服务端原样传给 Prisma，导致整条线索写入失败。
- 修复：服务端将 `applyingLevel` 及未知表单字段归入已有 `Lead.extra`，避免未知列导致保存失败；Widget 检查线索接口响应并在失败时提示。
- 验证：server 测试 48/48、widget 测试 10/10、server build、widget build、git diff --check 通过。
