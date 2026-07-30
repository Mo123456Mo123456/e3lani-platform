FROM node:22-bookworm-slim
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml ./
COPY apps/admin ./apps/admin
RUN pnpm install --filter @planet/admin... --frozen-lockfile=false \
  && pnpm --filter @planet/admin build
WORKDIR /app/apps/admin
EXPOSE 3001
CMD ["pnpm", "start"]
