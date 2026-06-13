#!/usr/bin/env bash
# Fix API 500 — nginx proxies /api/v1 directly to NestJS (port 4001).
# Run: cd /var/www/hellodownloader && sudo bash deploy/fix-api-proxy.sh

set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/hellodownloader}"
SNIPPET_SRC="${APP_DIR}/deploy/nginx-hd-locations.conf"
SNIPPET_DST="/etc/nginx/snippets/hellodownloader-hd-locations.conf"
SITE="/etc/nginx/sites-available/hellodownloader"

if [[ ! -f "${SNIPPET_SRC}" ]]; then
  echo "CRITICAL: Missing ${SNIPPET_SRC} — run git pull first"
  exit 1
fi

mkdir -p "${APP_DIR}/apps/web/public/uploads"
mkdir -p /etc/nginx/snippets

sed "s|/var/www/hellodownloader|${APP_DIR}|g" "${SNIPPET_SRC}" > "${SNIPPET_DST}"

if [[ ! -f "${SITE}" ]]; then
  echo "CRITICAL: Missing ${SITE} — run deploy/fix-ssl.sh or vps-bootstrap first"
  exit 1
fi

INCLUDE='include /etc/nginx/snippets/hellodownloader-hd-locations.conf;'

if ! grep -q 'hellodownloader-hd-locations.conf' "${SITE}"; then
  # Add include after each hellodownloader.com server_name line
  sed -i "/server_name hellodownloader.com;/a\\    ${INCLUDE}" "${SITE}"
  echo "Added nginx include for API + uploads"
else
  echo "Nginx include already present"
fi

nginx -t
systemctl reload nginx

echo ""
echo "==> Tests..."
sleep 1
API=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 https://hellodownloader.com/api/v1/ads/config 2>/dev/null || echo 000)
HDR=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 https://hellodownloader.com/api/v1/content/pages/header 2>/dev/null || echo 000)
echo "  /api/v1/ads/config          → ${API}"
echo "  /api/v1/content/pages/header → ${HDR}"
if [[ "${API}" == "200" && "${HDR}" == "200" ]]; then
  echo ""
  echo "Fixed. Hard refresh https://hellodownloader.com"
else
  echo ""
  echo "If still failing:"
  echo "  pm2 status"
  echo "  pm2 logs hd-api --lines 30"
  echo "  curl -s http://127.0.0.1:4001/api/v1/ads/config"
fi
