FROM node:22-alpine
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter @living-planet/realtime-gateway... build
USER node
EXPOSE 4100
CMD ["pnpm", "--filter", "@living-planet/realtime-gateway", "start"]
