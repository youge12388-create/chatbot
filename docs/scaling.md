# 多实例扩展（第二档）

## 目标

让 Chat API 从“单机单进程”升级为“多实例可水平扩展”，为访问量增长做准备。当前定位：
单机 50 人以内不崩不需要本档；本档用于后续按需扩容。

## 能力

- 实时推送（widget SSE / 后台 SSE）支持 Redis pub/sub 跨实例分发。
- 多实例同时启动时，`prisma db push + seed` 通过 Redis 初始化锁避免互踩。
- SSE 长连接每实例有上限，防止异常连接拖垮单实例。
- 未配置 Redis 时自动回退内存推送，单机行为与旧版一致。

## 配置

环境变量：

```env
REDIS_URL="redis://localhost:6379"
MAX_SSE_CONNECTIONS=500
```

- `REDIS_URL`：配置后启用 Redis 推送；不配置则使用进程内推送（仅单实例有效）。
- `MAX_SSE_CONNECTIONS`：单个实例最多同时建立的 SSE 长连接数，超限返回 503。

`docker-compose.yml` 已包含 `redis` 服务，并把 `REDIS_URL` 注入 `server`。

## 部署方式

### 单实例（现状）

不配置 `REDIS_URL`，行为与升级前完全一致，无需 Redis。

### 多实例

1. 部署并配置 Redis（docker compose 或独立 Redis）。
2. 多个 server 实例使用同一个 `DATABASE_URL` 和 `REDIS_URL`。
3. 负载均衡把请求分发到各实例（Nginx upstream / 云负载均衡）。
4. 生产更新流程不变；每个实例启动时由 Redis 锁保证只有一台执行建表和 seed。

## 边界与注意事项

- Redis pub/sub 消息是易失的：订阅者不在线时会错过消息。
- Widget 和后台已有补偿机制：widget 用 `messages?after=` 重连拉取，后台用 `notifications?since=` 回放，因此跨实例短暂丢失可恢复。
- 多实例部署时，各实例的 SSE 连接上限是独立统计的，总上限 = 实例数 × `MAX_SSE_CONNECTIONS`。
- Redis 连接失败不会阻止服务启动：自动回退内存推送，并每 30 秒重试恢复 Redis。

## 回滚

本档是 opt-in：去掉 `REDIS_URL` 即回到单机内存模式；代码改动均可通过普通生产更新流程回滚。

## 限流、缓存与 Dify 保护（第一档）

三个保护层，代码位于 `packages/server/src/utils/`：

- 限流 `rate-limit.ts`：按客户端 IP 对聊天接口分档限流，超限返回 429 + `Retry-After`。
  - `CHAT_RATE_LIMIT_MESSAGE=60` / `CHAT_RATE_LIMIT_MUTATION=60` / `CHAT_RATE_LIMIT_READ=120`（每 IP 每分钟）。
  - `RATE_LIMIT_DISABLED=1` 可在压测/排查时绕过。
  - 通过 `X-Forwarded-For` 取真实客户端 IP，适配 Nginx 反向代理。
- 缓存 `memory-cache.ts`：站点公开配置（`site:*`）与 FAQ（`faqs:*`）按 10 秒 TTL 缓存，降低数据库压力；后台改动最迟 10 秒生效。
- Dify 并发 `concurrency.ts`：信号量限制同时打向 Dify 的请求数（`DIFY_MAX_CONCURRENT=20`），队列满时快速返回兜底文案，避免上游被打爆。

## 验证记录

2026-08-24：本地用 `redis-memory-server`（Windows 下 Memurai）起临时 Redis，
运行 `node scripts/smoke-redis-pubsub.mjs`，两个独立 Node 进程分别订阅/发布，
会话消息与后台消息均跨进程送达，冒烟通过。

2026-08-24：`node scripts/load-test.mjs`（50 连接、读接口 3000 次、写接口 500 次）：
0 失败、0 非 2xx。P99：health 35ms / site 46ms / faqs 29ms / session 49ms / message 142ms。
message 走 FAQ 命中，未触发 Dify，用于验证后端+数据库的完整链路。

2026-08-24：第一档（限流+缓存+Dify 并发）落地后再次压测，50 连接、0 失败、0 非 2xx。P99：health 45ms / site 41ms / faqs 24ms / session 61ms / message 175ms。
