FROM node:22-alpine
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter @living-planet/api... build
USER node
EXPOSE 4000
CMD ["sh", "-c", "pnpm --filter @living-planet/api db:migrate && pnpm --filter @living-planet/api start"]
