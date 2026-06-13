#!/usr/bin/env bash
# Fix "Failed to fetch" on login — API subdomain 502, use same-domain /api/v1
# Run: cd /var/www/hellodownloader && sudo bash deploy/fix-login.sh

set -euo pipefail

cd /var/www/hellodownloader

echo "==> Update .env (API returns public URLs on main domain)..."
sed -i 's|^NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=/api/v1|' .env
sed -i 's|^API_PUBLIC_URL=.*|API_PUBLIC_URL=https://hellodownloader.com|' .env

echo "==> Web build env (Next.js rewrites to local API)..."
cat > apps/web/.env.production <<'EOF'
NEXT_PUBLIC_API_URL=/api/v1
API_PUBLIC_URL=http://127.0.0.1:4001
EOF

echo "==> Rebuild web..."
NODE_ENV=development pnpm install --ignore-scripts 2>/dev/null || true
pnpm --filter @hellodownloader/web build

echo "==> Restart apps..."
pm2 restart hd-api hd-web
sleep 3

echo "==> Test login API through main domain..."
curl -sf -X POST https://hellodownloader.com/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test","password":"test"}' | head -c 120 || true
echo ""

echo ""
echo "Done. Login at https://hellodownloader.com/login"
echo "Admin creds: cat /root/hellodownloader-admin.txt"
