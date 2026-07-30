FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages ./packages
COPY apps/web ./apps/web
RUN pnpm install --filter @planet/web...
WORKDIR /app/apps/web
RUN pnpm build

FROM node:22-alpine
WORKDIR /app/apps/web
ENV NODE_ENV=production
COPY --from=deps /app /app
EXPOSE 3000
CMD ["pnpm", "start"]
