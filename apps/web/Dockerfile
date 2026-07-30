# Web app image — builds the Next.js production bundle.
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

ARG NEXT_PUBLIC_API_URL=http://localhost:4100
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc tsconfig.base.json ./
COPY packages ./packages
COPY apps/web ./apps/web

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @planet/web build

WORKDIR /app/apps/web
EXPOSE 3000
CMD ["pnpm", "start"]
