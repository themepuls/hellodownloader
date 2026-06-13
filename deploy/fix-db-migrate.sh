#!/usr/bin/env bash
# Fix Prisma P3005 after pnpm install ran db:push on a fresh VPS.
# Safe on empty production DB (no user data yet).
# Run on VPS: sudo bash deploy/fix-db-migrate.sh

set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/hellodownloader}"
cd "${APP_DIR}"

if [[ ! -f .env ]]; then
  echo "Missing ${APP_DIR}/.env"
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

echo "==> Reset public schema (empty DB only — all data will be removed)"
sudo -u postgres psql -d hellodownloader <<'SQL'
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO hellodownloader;
GRANT ALL ON SCHEMA public TO public;
SQL

echo "==> Apply migrations..."
pnpm db:migrate:deploy

echo "==> Create admin..."
node scripts/create-admin.mjs

echo "==> Restart app..."
pm2 restart deploy/ecosystem.config.cjs 2>/dev/null || pm2 start deploy/ecosystem.config.cjs

echo "Done. Database migrated successfully."
