FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/admin ./apps/admin
RUN pnpm install --filter @planet/admin...
WORKDIR /app/apps/admin
RUN pnpm build
FROM node:22-alpine
WORKDIR /app/apps/admin
ENV NODE_ENV=production
COPY --from=deps /app /app
EXPOSE 3001
CMD ["pnpm", "start"]
