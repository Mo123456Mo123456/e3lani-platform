# Build from the repository root so ../../tsconfig.base.json is available:
# docker build -f apps/admin/Dockerfile .
FROM node:22-alpine AS build
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /workspace
COPY . .
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm install --frozen-lockfile --filter @kawkab/admin...
RUN pnpm --filter @kawkab/admin build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs
COPY --from=build --chown=nextjs:nodejs /workspace/apps/admin/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /workspace/apps/admin/.next/static ./apps/admin/.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "apps/admin/server.js"]
