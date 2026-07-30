FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/shared-types ./packages/shared-types
COPY packages/simulation-models ./packages/simulation-models
COPY packages/database ./packages/database
COPY services/api ./services/api
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @planet/api... build

FROM node:22-alpine
ENV NODE_ENV=production
USER node
WORKDIR /app
COPY --from=build --chown=node:node /repo/services/api/dist ./dist
COPY --from=build --chown=node:node /repo/node_modules ./node_modules
COPY --from=build --chown=node:node /repo/packages ./packages
EXPOSE 4000
CMD ["node", "dist/main.js"]
