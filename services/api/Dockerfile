FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY packages ./packages
COPY services/api ./services/api
RUN pnpm install --frozen-lockfile --filter @kawkab/api...
RUN pnpm --filter @kawkab/api^... build
RUN pnpm --filter @kawkab/api build
RUN pnpm --filter @kawkab/api exec prisma generate

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/services/api
EXPOSE 4000
CMD ["node", "dist/main.js"]
