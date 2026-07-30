FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages ./packages
COPY services/ai-orchestrator ./services/ai-orchestrator
COPY services/api ./services/api
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @planet/api build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
RUN addgroup -S planet && adduser -S planet -G planet
WORKDIR /app/services/api
COPY --from=build /app/services/api/dist ./dist
COPY --from=build /app/services/api/migrations ./migrations
COPY --from=build /app/services/api/package.json ./
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/services/api/node_modules ./node_modules
USER planet
EXPOSE 4000
CMD ["node", "dist/server.js"]
