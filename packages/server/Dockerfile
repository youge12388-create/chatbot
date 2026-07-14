FROM node:20-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y openssl libssl-dev ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY packages/server/package.json packages/server/tsconfig.json ./packages/server/
COPY packages/widget/package.json packages/widget/tsconfig.json packages/widget/vite.config.ts ./packages/widget/
COPY packages/admin/package.json packages/admin/tsconfig.json packages/admin/tsconfig.node.json packages/admin/vite.config.ts packages/admin/tailwind.config.js packages/admin/postcss.config.js packages/admin/index.html ./packages/admin/
COPY packages/server/prisma ./packages/server/prisma

# 安装阶段不执行依赖 postinstall；Prisma Client 会在后续 npm run build 中显式生成。
# 这避免云构建环境因第三方安装脚本异常而让 npm ci 整体失败。
RUN npm ci --ignore-scripts

COPY packages/server/src ./packages/server/src
COPY packages/widget/src ./packages/widget/src
COPY packages/admin/src ./packages/admin/src
COPY scripts/sync-widget.mjs scripts/sync-admin.mjs ./scripts/

# 构建 widget -> sync -> 构建 admin -> sync -> 构建 server
RUN npm run build
# 确认产物存在
RUN ls -la packages/server/public/widget.js
RUN ls -la packages/server/public/admin/index.html

FROM node:20-bookworm-slim AS runner

WORKDIR /app/packages/server

RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/packages/server/dist ./dist
COPY --from=builder /app/packages/server/package.json ./
COPY --from=builder /app/packages/server/tsconfig.json ./
COPY --from=builder /app/packages/server/public ./public
COPY --from=builder /app/packages/server/prisma ./prisma
ENV NODE_ENV=production
EXPOSE 3001

CMD ["npm", "start"]
