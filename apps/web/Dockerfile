# Build with the workspace root as context:
# docker build -f apps/web/Dockerfile .
FROM node:22-alpine AS build
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /workspace
COPY . .
RUN pnpm install --frozen-lockfile
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SANDBOX_MODE=false
ARG NEXT_PUBLIC_ALLOW_SANDBOX_REGISTRATION=false
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SANDBOX_MODE=$NEXT_PUBLIC_SANDBOX_MODE
ENV NEXT_PUBLIC_ALLOW_SANDBOX_REGISTRATION=$NEXT_PUBLIC_ALLOW_SANDBOX_REGISTRATION
RUN pnpm --filter @kawkab/web build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs
COPY --from=build --chown=nextjs:nodejs /workspace/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /workspace/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=nextjs:nodejs /workspace/apps/web/public ./apps/web/public
USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
