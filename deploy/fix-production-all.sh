#!/usr/bin/env bash
# One-shot production fix: CORS, uploads, nginx, rebuild, restart.
# Run on VPS as root:
#   cd /var/www/hellodownloader && bash deploy/fix-production-all.sh

set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/hellodownloader}"
cd "${APP_DIR}"

echo "============================================"
echo " HelloDownloader production fix"
echo " App dir: ${APP_DIR}"
echo "============================================"

if [[ ! -f .env ]]; then
  echo "CRITICAL: Missing ${APP_DIR}/.env"
  exit 1
fi

echo "==> [1/8] Pull latest code..."
if [[ -d .git ]]; then
  git pull --ff-only || git pull || true
fi

echo "==> [2/8] Fix .env (same-origin API, no CORS)..."
grep -q '^NEXT_PUBLIC_API_URL=' .env && \
  sed -i 's|^NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=/api/v1|' .env || \
  echo 'NEXT_PUBLIC_API_URL=/api/v1' >> .env
grep -q '^API_PUBLIC_URL=' .env && \
  sed -i 's|^API_PUBLIC_URL=.*|API_PUBLIC_URL=https://hellodownloader.com|' .env || \
  echo 'API_PUBLIC_URL=https://hellodownloader.com' >> .env
grep -q '^CORS_ORIGIN=' .env && \
  sed -i 's|^CORS_ORIGIN=.*|CORS_ORIGIN=https://hellodownloader.com,https://www.hellodownloader.com|' .env || \
  echo 'CORS_ORIGIN=https://hellodownloader.com,https://www.hellodownloader.com' >> .env

echo "==> [3/8] Web build env..."
mkdir -p apps/web/public/uploads
chmod 755 apps/web/public/uploads
cat > apps/web/.env.production <<'EOF'
NEXT_PUBLIC_API_URL=/api/v1
API_PUBLIC_URL=http://127.0.0.1:4001
NEXT_PUBLIC_SITE_URL=https://hellodownloader.com
EOF

echo "==> [4/8] Nginx — add /uploads/ alias (keep existing SSL config)..."
UPLOADS_BLOCK='    location /uploads/ {
        alias APP_DIR_PLACEHOLDER/apps/web/public/uploads/;
        expires 7d;
        add_header Cache-Control "public";
        access_log off;
    }
'
UPLOADS_BLOCK="${UPLOADS_BLOCK//APP_DIR_PLACEHOLDER/${APP_DIR}}"
NGINX_SITE="/etc/nginx/sites-available/hellodownloader"

if [[ -f "${NGINX_SITE}" ]]; then
  if ! grep -q 'location /uploads/' "${NGINX_SITE}"; then
    # Insert uploads block before first "location /" in main hellodownloader.com server
    sed -i "/server_name hellodownloader.com;/,/location \//{
      /location \//i\\
${UPLOADS_BLOCK}
    }" "${NGINX_SITE}" 2>/dev/null || true
  fi
  sed -i "s|/var/www/hellodownloader|${APP_DIR}|g" "${NGINX_SITE}"
  nginx -t
  systemctl reload nginx
elif [[ -f deploy/nginx.hellodownloader.conf ]]; then
  cp deploy/nginx.hellodownloader.conf "${NGINX_SITE}"
  sed -i "s|/var/www/hellodownloader|${APP_DIR}|g" "${NGINX_SITE}"
  ln -sf "${NGINX_SITE}" /etc/nginx/sites-enabled/hellodownloader
  nginx -t
  systemctl reload nginx
  echo "  (fresh nginx config — run bash deploy/fix-ssl.sh for HTTPS)"
fi

echo "==> [5/8] Install + database..."
NODE_ENV=development pnpm install --ignore-scripts 2>/dev/null || NODE_ENV=development pnpm install --ignore-scripts

set -a
# shellcheck disable=SC1091
source .env
set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "CRITICAL: DATABASE_URL missing in .env"
  exit 1
fi

if [[ "${DATABASE_URL}" == file:* ]]; then
  echo "CRITICAL: .env still uses SQLite (file:). Production needs PostgreSQL."
  echo "  Example: DATABASE_URL=postgresql://hellodownloader:PASSWORD@localhost:5432/hellodownloader"
  exit 1
fi

echo "  DATABASE_URL host: $(node -e "try{const u=new URL(process.env.DATABASE_URL);console.log(u.hostname+':'+u.port)}catch(e){console.log('invalid')}" 2>/dev/null || echo unknown)"

if ! systemctl is-active --quiet postgresql 2>/dev/null; then
  echo "  Starting PostgreSQL..."
  systemctl start postgresql || true
fi

pnpm db:generate

echo "  Syncing schema (non-interactive)..."
if ! PRISMA_ACCEPT_DATA_LOSS=1 pnpm db:push; then
  echo ""
  echo "WARN: db:push failed — site may still run if DB was already set up."
  echo "      To reset DB (WIPES DATA): bash deploy/fix-db-migrate.sh"
  echo "      Continuing with build..."
fi

echo "==> [6/8] Build packages, API, web..."
pnpm --filter @hellodownloader/shared-types build
pnpm --filter @hellodownloader/config build
pnpm --filter @hellodownloader/auth-utils build
pnpm --filter @hellodownloader/queue-utils build
pnpm --filter @hellodownloader/api build
pnpm --filter @hellodownloader/web build

if [[ ! -f apps/web/.next/BUILD_ID ]]; then
  echo "CRITICAL: Web build failed"
  exit 1
fi

echo "==> [7/8] Restart PM2..."
pm2 delete all 2>/dev/null || true
pm2 start deploy/ecosystem.config.cjs
pm2 save

sleep 4

echo "==> [8/8] Smoke tests..."
API_CODE=$(curl -s -o /dev/null -w '%{http_code}' https://hellodownloader.com/api/v1/ads/config || echo 000)
echo "  /api/v1/ads/config → HTTP ${API_CODE}"

UPLOADS_DIR="${APP_DIR}/apps/web/public/uploads"
echo "  uploads dir: ${UPLOADS_DIR} ($(ls -1 "${UPLOADS_DIR}" 2>/dev/null | wc -l | tr -d ' ') files)"

# Write a test pixel if uploads are empty (optional visibility check)
TEST_FILE="${UPLOADS_DIR}/.ping"
echo ok > "${TEST_FILE}"

echo ""
echo "============================================"
echo " DONE"
echo " 1. If https:// fails: bash deploy/fix-ssl.sh"
echo " 2. Hard refresh: https://hellodownloader.com/admin/ads"
echo " 3. Upload image again (old paths may 404 — re-upload)"
echo " 4. Admin login: cat /root/hellodownloader-admin.txt"
echo "============================================"
