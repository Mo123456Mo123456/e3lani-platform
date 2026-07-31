# Multi-stage: build workspace, then run the compiled API with its deps.
FROM node:22-slim AS build
WORKDIR /repo
ENV CI=true

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

COPY package.json pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/validation/package.json packages/validation/
COPY packages/config/package.json packages/config/
COPY packages/api-client/package.json packages/api-client/
COPY packages/simulation-models/package.json packages/simulation-models/
COPY packages/analytics/package.json packages/analytics/
COPY packages/ui/package.json packages/ui/
COPY services/api/package.json services/api/
RUN pnpm install --frozen-lockfile=false

COPY packages ./packages
COPY services/api ./services/api
RUN pnpm -r --filter "./packages/*" run build
RUN pnpm --filter @planet/api run build

# deploy a pruned production node_modules tree for the api
RUN pnpm --filter @planet/api deploy --prod /out

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /out ./
COPY --from=build /repo/services/api/dist ./dist
COPY docs/openapi.yaml ./docs/openapi.yaml

EXPOSE 4000
CMD ["node", "dist/main.js"]
