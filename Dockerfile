FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV CI=true \
    EXPO_NO_TELEMETRY=1 \
    FFMPEG_PATH=/usr/bin/ffmpeg \
    VIDEO_FONT_PATH=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build:render

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "scripts/production-start.mjs"]
