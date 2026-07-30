FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY packages ./packages
COPY services/ai-orchestrator ./services/ai-orchestrator
RUN pnpm install --frozen-lockfile --filter @kawkab/ai-orchestrator...
RUN pnpm --filter @kawkab/ai-orchestrator^... build
RUN pnpm --filter @kawkab/ai-orchestrator build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/services/ai-orchestrator
EXPOSE 4100
CMD ["node", "dist/index.js"]
