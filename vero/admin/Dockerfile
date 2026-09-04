# VERO Admin — Next.js (standalone)
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --ignore-workspace --no-frozen-lockfile

FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable

# العنوان يُخبز داخل حزمة المتصفح وقت البناء
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ARG NEXT_PUBLIC_MAP_STYLE=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_MAP_STYLE=$NEXT_PUBLIC_MAP_STYLE
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -S vero && adduser -S vero -G vero

# ناتج standalone يحوي خادمًا مكتفيًا بذاته
COPY --from=build --chown=vero:vero /app/.next/standalone ./
COPY --from=build --chown=vero:vero /app/.next/static ./.next/static
COPY --from=build --chown=vero:vero /app/public ./public

USER vero
EXPOSE 3000
CMD ["node", "server.js"]
