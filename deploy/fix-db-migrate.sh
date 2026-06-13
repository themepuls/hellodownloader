#!/usr/bin/env bash
# Production DB setup — use db push (migrations are SQLite-only in this repo).
# Run on VPS from anywhere:
#   sudo bash /var/www/hellodownloader/deploy/fix-db-migrate.sh

set -euo pipefail

APP_DIR="/var/www/hellodownloader"
cd "${APP_DIR}"

if [[ ! -f .env ]]; then
  echo "CRITICAL: Missing ${APP_DIR}/.env"
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "CRITICAL: DATABASE_URL not set in .env"
  exit 1
fi

echo "==> Using DATABASE_URL: ${DATABASE_URL/@:*@/@:***@}"

echo "==> Reset PostgreSQL schema (safe only on empty / new VPS)"
sudo -u postgres psql -d hellodownloader <<'SQL'
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO hellodownloader;
GRANT ALL ON SCHEMA public TO public;
SQL

echo "==> Generate Prisma client + push schema to PostgreSQL..."
pnpm db:generate
pnpm db:push

echo "==> Create admin user..."
node scripts/create-admin.mjs

echo "==> Restart PM2..."
pm2 restart deploy/ecosystem.config.cjs 2>/dev/null || pm2 start deploy/ecosystem.config.cjs
pm2 save

echo ""
echo "Done. Test:"
echo "  curl http://127.0.0.1:4001/api/v1/downloads/quality-access"
echo "  curl -I http://127.0.0.1:3000"
