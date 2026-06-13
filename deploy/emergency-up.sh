#!/usr/bin/env bash
# Bring site back online — nginx + PM2 + optional SSL.
# Run: cd /var/www/hellodownloader && sudo bash deploy/emergency-up.sh

set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/hellodownloader}"
cd "${APP_DIR}"

echo "==> Services..."
systemctl start postgresql redis-server nginx 2>/dev/null || true

echo "==> PM2..."
if [[ -f deploy/ecosystem.config.cjs ]]; then
  pm2 start deploy/ecosystem.config.cjs 2>/dev/null || pm2 restart all
  pm2 save
else
  echo "WARN: ${APP_DIR} missing — check git clone at /var/www/hellodownloader"
fi

sleep 2
pm2 status || true

echo ""
echo "==> Ports..."
ss -tlnp | grep -E ':80|:443|:3000|:4001' || true

echo ""
echo "==> HTTP test..."
curl -s -o /dev/null -w "  http://127.0.0.1:3000 → %{http_code}\n" http://127.0.0.1:3000 || true
curl -s -o /dev/null -w "  http://hellodownloader.com → %{http_code}\n" http://hellodownloader.com || true

if ! curl -s -o /dev/null --connect-timeout 3 https://hellodownloader.com 2>/dev/null; then
  echo ""
  echo "HTTPS (443) not responding — run: bash deploy/fix-ssl.sh"
  echo "Until then use: http://hellodownloader.com"
fi
