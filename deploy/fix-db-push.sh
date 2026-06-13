#!/usr/bin/env bash
# Safe production db push — non-interactive, with diagnostics.
# Run: cd /var/www/hellodownloader && bash deploy/fix-db-push.sh

set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/hellodownloader}"
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
  echo "CRITICAL: DATABASE_URL not set"
  exit 1
fi

if [[ "${DATABASE_URL}" == file:* ]]; then
  echo "CRITICAL: DATABASE_URL is SQLite. Production needs postgresql://..."
  exit 1
fi

echo "==> PostgreSQL status..."
systemctl is-active postgresql || systemctl start postgresql

echo "==> Test connection (postgres superuser)..."
sudo -u postgres psql -d hellodownloader -c 'SELECT 1 AS ok;' || {
  echo "Database hellodownloader missing? Create it or fix DATABASE_URL in .env"
  exit 1
}

echo "==> Generate + push schema..."
pnpm db:generate
PRISMA_ACCEPT_DATA_LOSS=1 pnpm db:push

echo "Done."
