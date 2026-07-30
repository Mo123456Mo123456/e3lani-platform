FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY services/api ./services/api
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @planet/api... build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=build /app /app
EXPOSE 4000
CMD ["sh", "-c", "pnpm --filter @planet/api db:migrate && pnpm --filter @planet/api start"]
