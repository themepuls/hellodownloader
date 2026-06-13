#!/usr/bin/env bash
# Fix white screen / ChunkLoadError on live (stale JS chunks after deploy).
# Run on VPS:
#   cd /var/www/hellodownloader && bash deploy/fix-live-web.sh

set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/hellodownloader}"
cd "${APP_DIR}"

echo "==> Stop Next.js..."
pm2 stop hd-web 2>/dev/null || true

echo "==> Clean + rebuild web..."
rm -rf apps/web/.next
set -a
# shellcheck disable=SC1091
source .env
set +a
cp .env apps/web/.env.production
grep -q '^NEXT_PUBLIC_SITE_URL=' apps/web/.env.production || \
  echo 'NEXT_PUBLIC_SITE_URL=https://hellodownloader.com' >> apps/web/.env.production
pnpm --filter @hellodownloader/shared-types build
pnpm --filter @hellodownloader/web build

if [[ ! -f apps/web/.next/BUILD_ID ]]; then
  echo "CRITICAL: Web build failed"
  exit 1
fi

echo "==> Restart web..."
pm2 restart hd-web || pm2 start deploy/ecosystem.config.cjs --only hd-web
pm2 save

sleep 3
HTTP=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/ || echo 000)
echo "  localhost:3000 → HTTP ${HTTP}"
echo ""
echo "Done. Hard refresh in browser: Ctrl+Shift+R (or Cmd+Shift+R on Mac)"
echo "If still broken, clear site data for hellodownloader.com in browser settings."
