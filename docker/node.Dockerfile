FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps ./apps
COPY services ./services
COPY packages ./packages
ARG PACKAGE
RUN pnpm install --frozen-lockfile
RUN pnpm --filter "${PACKAGE}" build

FROM node:22-alpine AS runtime
RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
ARG PACKAGE
ENV APP_PACKAGE="${PACKAGE}"
CMD ["sh", "-c", "pnpm --filter \"${APP_PACKAGE}\" start"]
