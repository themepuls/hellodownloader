#!/usr/bin/env bash
# Redeploy after git pull — run from repo root on VPS:
#   bash deploy/redeploy.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Pull latest..."
git pull

echo "==> Install & build..."
pnpm install --ignore-scripts --frozen-lockfile 2>/dev/null || pnpm install --ignore-scripts
pnpm db:generate
pnpm --filter @hellodownloader/shared-types build
pnpm --filter @hellodownloader/config build
pnpm --filter @hellodownloader/auth-utils build
pnpm --filter @hellodownloader/queue-utils build

set -a
source .env
set +a
cp .env apps/web/.env.production

pnpm --filter @hellodownloader/api build
pnpm --filter @hellodownloader/web build
pnpm db:push

echo "==> Restart PM2..."
pm2 restart deploy/ecosystem.config.cjs
pm2 save

echo "Done. pm2 status"
