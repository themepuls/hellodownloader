FROM node:20-slim

RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    && pip3 install yt-dlp --break-system-packages \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages ./packages
COPY apps/worker-${WORKER} ./apps/worker

ARG WORKER=download
ENV WORKER=${WORKER}

RUN pnpm install --frozen-lockfile || pnpm install
RUN pnpm --filter @hellodownloader/database db:generate || true

CMD ["sh", "-c", "node apps/worker/src/index.ts"]
