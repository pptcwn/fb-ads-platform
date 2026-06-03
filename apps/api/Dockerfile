FROM node:20-alpine AS builder

RUN apk add --no-cache openssl

RUN corepack enable && corepack prepare pnpm@9.1.0 --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml turbo.json ./
COPY pnpm-lock.yaml* ./

COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/

RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter api build
RUN pnpm --filter api --prod deploy /deploy

FROM node:20-alpine AS production

WORKDIR /app
COPY --from=builder /deploy .

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/api/health || exit 1

CMD ["node", "dist/main"]
