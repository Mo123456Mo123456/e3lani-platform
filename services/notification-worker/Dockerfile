FROM node:22-alpine
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter @living-planet/notification-worker... build
USER node
CMD ["pnpm", "--filter", "@living-planet/notification-worker", "start"]
