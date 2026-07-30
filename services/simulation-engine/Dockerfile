FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY packages ./packages
COPY services/simulation-engine ./services/simulation-engine
RUN pnpm install --frozen-lockfile --filter @kawkab/simulation-engine...
RUN pnpm --filter @kawkab/simulation-engine^... build
RUN pnpm --filter @kawkab/simulation-engine build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/services/simulation-engine
CMD ["node", "dist/index.js"]
