# VERO API — Fastify + PostgreSQL/PostGIS
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --prod=false --ignore-workspace --no-frozen-lockfile

FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN pnpm build

FROM node:22-alpine AS prod-deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --prod --ignore-workspace --no-frozen-lockfile

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# مستخدم غير جذري
RUN addgroup -S vero && adduser -S vero -G vero

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# ملفات SQL للهجرات + الخطوط العربية للتقارير: ليست جزءًا من ناتج tsc
COPY src/db/migrations ./dist/db/migrations
COPY assets ./assets
COPY package.json ./

RUN mkdir -p /data/storage/backups && chown -R vero:vero /data /app
USER vero

EXPOSE 4000
CMD ["node", "dist/index.js"]
