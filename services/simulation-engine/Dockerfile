FROM node:22-bookworm-slim
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml ./
COPY packages ./packages
COPY services/simulation-engine ./services/simulation-engine
RUN pnpm install --filter @planet/simulation-engine... --frozen-lockfile=false \
  && pnpm --filter @planet/config --filter @planet/shared-types --filter @planet/simulation-models build \
  && pnpm --filter @planet/simulation-engine build
WORKDIR /app/services/simulation-engine
EXPOSE 4102
CMD ["node", "dist/index.js"]
