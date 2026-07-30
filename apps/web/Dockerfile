FROM node:22-alpine
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter @living-planet/web... build
USER node
EXPOSE 3000
CMD ["pnpm", "--filter", "@living-planet/web", "start"]
