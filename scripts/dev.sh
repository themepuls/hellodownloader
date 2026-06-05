#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."

echo "==> Installing dependencies..."
pnpm install

echo "==> Setting up database..."
pnpm run setup

echo "==> Starting API (port 4000) and Web (port 3000)..."
echo "    Press Ctrl+C to stop"
pnpm exec concurrently -k \
  "pnpm --filter @hellodownloader/api dev" \
  "pnpm --filter @hellodownloader/web dev"
