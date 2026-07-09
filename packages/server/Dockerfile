FROM node:20-bookworm-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/server/package.json packages/server/tsconfig.json ./packages/server/
COPY packages/server/prisma ./packages/server/prisma

RUN npm ci --workspace=packages/server

COPY packages/server/src ./packages/server/src

RUN npm run db:generate -w packages/server
RUN npm run build -w packages/server

FROM node:20-bookworm-slim AS runner

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/server/prisma ./packages/server/prisma
COPY --from=builder /app/packages/server/package.json ./packages/server/package.json
COPY --from=builder /app/packages/server/tsconfig.json ./packages/server/tsconfig.json

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "packages/server/dist/index.js"]
