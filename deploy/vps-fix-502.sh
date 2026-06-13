#!/usr/bin/env bash
# Fix 502: git pull conflict + build Next.js + restart PM2
# Run on VPS: cd /var/www/hellodownloader && sudo bash deploy/vps-fix-502.sh

set -euo pipefail

APP_DIR="/var/www/hellodownloader"
cd "${APP_DIR}"

echo "==> [1/5] Fix git pull (discard local Prisma generated file changes on server)..."
git checkout -- packages/database/src/generated/prisma/ 2>/dev/null || true
git pull origin main

echo "==> [2/5] .env BullMQ off (inline downloads on API)..."
sed -i 's/USE_BULLMQ_DOWNLOADS=true/USE_BULLMQ_DOWNLOADS=false/' .env || true
sed -i 's/USE_BULLMQ_THUMBNAILS=true/USE_BULLMQ_THUMBNAILS=false/' .env || true

set -a
# shellcheck disable=SC1091
source .env
set +a

echo "==> [3/5] Install + build..."
pnpm install --ignore-scripts
pnpm db:generate
pnpm --filter @hellodownloader/shared-types build
pnpm --filter @hellodownloader/config build
pnpm --filter @hellodownloader/auth-utils build
pnpm --filter @hellodownloader/queue-utils build
pnpm --filter @hellodownloader/api build
cp .env apps/web/.env.production
pnpm --filter @hellodownloader/web build

if [[ ! -f apps/web/.next/BUILD_ID ]]; then
  echo "CRITICAL: Next.js build failed. Run: pm2 logs hd-web --lines 50"
  exit 1
fi

echo "==> [4/5] Restart PM2..."
pm2 delete all 2>/dev/null || true
pm2 start deploy/ecosystem.config.cjs
pm2 save

echo "==> [5/5] Verify..."
sleep 4
pm2 status
curl -sf http://127.0.0.1:4001/api/v1/downloads/quality-access && echo ""
curl -sfI http://127.0.0.1:3000 | head -3

echo ""
echo "Done. Open http://hellodownloader.com"
