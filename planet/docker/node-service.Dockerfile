# Generic build for workspace node services/apps.
# Build context MUST be the monorepo root (planet/).
#   docker build -f docker/node-service.Dockerfile --build-arg PACKAGE=@planet/api .
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

FROM base AS deps
ARG PACKAGE
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages ./packages
COPY services ./services
COPY apps ./apps
RUN pnpm install --frozen-lockfile --filter "${PACKAGE}..." --ignore-scripts || pnpm install --filter "${PACKAGE}..."

FROM deps AS build
ARG PACKAGE
RUN pnpm --filter "${PACKAGE}..." run build \
  && pnpm --filter "${PACKAGE}" exec prisma generate 2>/dev/null || true

FROM base AS runtime
ARG PACKAGE
ENV NODE_ENV=production
COPY --from=build /repo /repo
WORKDIR /repo
# Every service/app exposes a `start` script (node dist/main.js or next start).
CMD sh -c "pnpm --filter '${PACKAGE}' run start"
