FROM node:22-alpine
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter @living-planet/api... build
USER node
EXPOSE 4000
CMD ["sh", "-c", "node services/api/dist/migrate.js && if [ \"$SANDBOX_MODE\" = \"true\" ]; then node services/api/dist/seed.js; fi && node services/api/dist/index.js"]
