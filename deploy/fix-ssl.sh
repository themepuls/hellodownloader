#!/usr/bin/env bash
# Restore HTTPS after nginx config was reset (port 443 connection refused).
# Run on VPS: cd /var/www/hellodownloader && sudo bash deploy/fix-ssl.sh

set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/hellodownloader}"

echo "==> Install certbot if needed..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y >/dev/null 2>&1 || true
apt-get install -y certbot python3-certbot-nginx >/dev/null 2>&1 || true

echo "==> Ensure nginx is running..."
systemctl enable nginx
systemctl start nginx

echo "==> Issue / renew Let's Encrypt certificates..."
certbot --nginx \
  -d hellodownloader.com \
  -d www.hellodownloader.com \
  -d api.hellodownloader.com \
  --non-interactive \
  --agree-tos \
  --register-unsafely-without-email \
  --redirect \
  || certbot --nginx \
    -d hellodownloader.com \
    -d www.hellodownloader.com \
    -d api.hellodownloader.com

nginx -t
systemctl reload nginx

echo ""
echo "==> Test..."
HTTP=$(curl -s -o /dev/null -w '%{http_code}' http://hellodownloader.com || echo 000)
HTTPS=$(curl -s -o /dev/null -w '%{http_code}' https://hellodownloader.com || echo 000)
echo "  http://hellodownloader.com  → ${HTTP}"
echo "  https://hellodownloader.com → ${HTTPS}"
echo ""
if [[ "${HTTPS}" == "200" || "${HTTPS}" == "301" || "${HTTPS}" == "302" ]]; then
  echo "SSL OK. Open https://hellodownloader.com"
else
  echo "If HTTPS still fails, open port 443: ufw allow 443 && ufw reload"
fi
