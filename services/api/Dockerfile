FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages ./packages
COPY services/api ./services/api
COPY services/ai-orchestrator/package.json ./services/ai-orchestrator/package.json
COPY services/simulation-engine/package.json ./services/simulation-engine/package.json
COPY services/world-generator/package.json ./services/world-generator/package.json
COPY services/realtime-gateway/package.json ./services/realtime-gateway/package.json
COPY services/notification-worker/package.json ./services/notification-worker/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/admin/package.json ./apps/admin/package.json

RUN pnpm install --filter @planet/api... --frozen-lockfile=false
RUN pnpm --filter @planet/config --filter @planet/shared-types --filter @planet/validation --filter @planet/simulation-models --filter @planet/analytics build
RUN pnpm --filter @planet/api build

WORKDIR /app/services/api
EXPOSE 4100
CMD ["node", "dist/index.js"]
