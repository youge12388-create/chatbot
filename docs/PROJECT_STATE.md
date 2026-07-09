# PROJECT_STATE

## 项目目标
网站 AI 客服与线索转化系统。包含 Chat API 后端、Widget 前端聊天窗口、Dify 大模型知识库、PostgreSQL 数据库、n8n 自动化通知。

## 当前进度
- [x] 技术方案设计
- [x] Chat API 后端（Express + TypeScript + Prisma）
- [x] Widget 聊天窗口（Vanilla TS + Vite + Shadow DOM）
- [x] 数据库 Schema（6 表）
- [x] n8n 集成（workflow 文件 + Docker 编排）
- [ ] 联合测试（需要 Docker 或 PostgreSQL 环境）
- [ ] 线上部署

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

## 验证结果
- server tsc build: 通过，0 错误
- `build` 脚本内联 `prisma generate`: 通过，一次命令完成 generate + compile
- widget vite build: 通过，12.81 kB (gzip 4.62 kB）
- 4 个接口空参数校验: 均返回 400 + 明确错误信息
- 健康检查: 正常返回 `{"status":"ok"}`
- Docker 镜像构建: 未在云服务器验证（待执行）

## 已知问题
- 本地无法安装 Docker，所有运行验证需转移到云服务器 122.51.62.116
- Dify API Key 未配置，AI 对话走兜底回复
- 企微/飞书 webhook URL 未配置，n8n workflow 中为占位符
- FAQ 关键词路由返回 `category.answer!` 存在返回 `undefined` 风险

## 下一步
1. 将代码上传到云服务器 122.51.62.116
2. 在云服务器执行 `scripts/deploy.sh` 完成一键部署
3. 配置云平台安全组，放行 3001、5678、5432 端口
4. 用 pgAdmin 连接云数据库验证表结构和初始数据
5. 配置 Dify API Key，接入知识库
6. 配置企微/飞书 webhook URL
7. 端到端测试：widget 发消息 → API → Dify → n8n → 通知
8. 修复 FAQ 路由返回 undefined 的问题
9. 编写单元测试
10. 生产环境部署准备（HTTPS、环境变量、密钥管理）