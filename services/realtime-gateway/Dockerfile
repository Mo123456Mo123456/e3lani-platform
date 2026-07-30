FROM node:22-alpine
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY services ./services
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @kawkab/realtime-gateway build
EXPOSE 4010
CMD ["pnpm", "--filter", "@kawkab/realtime-gateway", "start"]
