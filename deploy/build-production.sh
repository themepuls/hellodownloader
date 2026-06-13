#!/usr/bin/env bash
# Build HelloDownloader for production on VPS.
# Run: cd /var/www/hellodownloader && bash deploy/build-production.sh

set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "CRITICAL: Missing .env in $(pwd)"
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

echo "==> Install dependencies (skip postinstall db:push)..."
NODE_ENV=development pnpm install --ignore-scripts

echo "==> Database schema..."
pnpm db:generate
pnpm db:push

echo "==> Build workspace packages..."
pnpm --filter @hellodownloader/shared-types build
pnpm --filter @hellodownloader/config build
pnpm --filter @hellodownloader/auth-utils build
pnpm --filter @hellodownloader/queue-utils build

echo "==> Build API..."
pnpm --filter @hellodownloader/api build

echo "==> Build Web (requires TypeScript)..."
cp .env apps/web/.env.production
pnpm --filter @hellodownloader/web build

if [[ ! -f apps/web/.next/BUILD_ID ]]; then
  echo "CRITICAL: Next.js build failed — apps/web/.next/BUILD_ID missing"
  exit 1
fi

if [[ ! -f apps/api/dist/main.js ]]; then
  echo "CRITICAL: API build failed — apps/api/dist/main.js missing"
  exit 1
fi

echo "==> Build OK. Restart PM2:"
echo "    pm2 restart deploy/ecosystem.config.cjs"
