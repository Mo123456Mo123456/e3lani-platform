FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages ./packages
COPY services/api ./services/api
RUN pnpm install --filter @planet/api...

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app /app
WORKDIR /app/services/api
EXPOSE 4000
CMD ["pnpm", "exec", "tsx", "src/index.ts"]
