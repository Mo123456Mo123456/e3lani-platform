FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/admin ./apps/admin
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @planet/admin build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
RUN addgroup -S planet && adduser -S planet -G planet
WORKDIR /app
COPY --from=build /app/apps/admin/.next/standalone ./
COPY --from=build /app/apps/admin/.next/static ./apps/admin/.next/static
USER planet
EXPOSE 3001
CMD ["node", "apps/admin/server.js"]
