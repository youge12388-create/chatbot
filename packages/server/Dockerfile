FROM node:20-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y openssl libssl-dev ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY packages/server/package.json packages/server/tsconfig.json ./packages/server/
COPY packages/server/prisma ./packages/server/prisma

RUN npm ci --workspace=packages/server

COPY packages/server/src ./packages/server/src

RUN npm run db:generate -w packages/server
RUN npm run build -w packages/server

FROM node:20-bookworm-slim AS runner

WORKDIR /app/packages/server

RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/packages/server/dist ./dist
COPY --from=builder /app/packages/server/prisma ./prisma
COPY --from=builder /app/packages/server/package.json ./
COPY --from=builder /app/packages/server/tsconfig.json ./
COPY packages/server/public ./public
ENV NODE_ENV=production
EXPOSE 3001

CMD ["npm", "start"]
