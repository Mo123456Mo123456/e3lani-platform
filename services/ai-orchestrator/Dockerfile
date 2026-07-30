FROM node:22-bookworm-slim
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml ./
COPY packages ./packages
COPY services/ai-orchestrator ./services/ai-orchestrator
RUN pnpm install --filter @planet/ai-orchestrator... --frozen-lockfile=false \
  && pnpm --filter @planet/config --filter @planet/shared-types --filter @planet/validation --filter @planet/simulation-models build \
  && pnpm --filter @planet/ai-orchestrator build
WORKDIR /app/services/ai-orchestrator
EXPOSE 4101
CMD ["node", "dist/index.js"]
