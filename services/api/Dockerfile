# API service image — monorepo-aware (workspace packages ship as TS source,
# executed by tsx; no separate compile step required).
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc tsconfig.base.json ./
COPY packages ./packages
COPY services/api ./services/api

RUN pnpm install --frozen-lockfile

WORKDIR /app/services/api
EXPOSE 4100
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4100/health || exit 1
CMD ["pnpm", "start"]
