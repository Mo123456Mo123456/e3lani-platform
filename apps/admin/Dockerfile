FROM node:22-alpine
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter @living-planet/admin... build
USER node
EXPOSE 3001
CMD ["node", "node_modules/next/dist/bin/next", "start", "apps/admin", "--port", "3001"]
