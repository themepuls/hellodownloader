#!/usr/bin/env bash
# Local dev setup — SQLite, no Docker required
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Generate + sync SQLite database..."
pnpm db:generate
pnpm db:push

echo "==> Create local admin..."
ADMIN_EMAIL=admin@hellodownloader.local ADMIN_PASSWORD=Admin123! node scripts/create-admin.mjs

echo ""
echo "Done. Start dev servers:"
echo "  pnpm dev"
echo "Login: admin@hellodownloader.local / Admin123!"
