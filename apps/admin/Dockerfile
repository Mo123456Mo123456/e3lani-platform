# Admin console image — vite build + static preview with /api proxy.
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

ARG API_URL=http://api:4100
ENV API_URL=$API_URL

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc tsconfig.base.json ./
COPY packages ./packages
COPY apps/admin ./apps/admin

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @planet/admin build

WORKDIR /app/apps/admin
EXPOSE 3100
CMD ["pnpm", "preview", "--host", "0.0.0.0"]
