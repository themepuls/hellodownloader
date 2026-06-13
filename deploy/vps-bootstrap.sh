#!/usr/bin/env bash
# One-shot HelloDownloader VPS bootstrap — run ON THE SERVER as root:
#   curl -fsSL https://raw.githubusercontent.com/themepuls/hellodownloader/main/deploy/vps-bootstrap.sh | sudo bash
#
# Or after git clone:
#   sudo bash deploy/vps-bootstrap.sh

set -euo pipefail

APP_DIR="/var/www/hellodownloader"
REPO="https://github.com/themepuls/hellodownloader.git"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash deploy/vps-bootstrap.sh"
  exit 1
fi

echo "==> [1/8] System packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y git curl nginx certbot python3-certbot-nginx ufw

echo "==> [2/8] Node 20 + PM2 + pnpm..."
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | tr -d v | cut -d. -f1)" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
npm install -g pm2 pnpm@9

echo "==> [3/8] Postgres, Redis, FFmpeg, yt-dlp..."
apt-get install -y postgresql postgresql-contrib redis-server ffmpeg
systemctl enable --now postgresql redis-server

if ! command -v yt-dlp >/dev/null 2>&1; then
  curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
  chmod a+rx /usr/local/bin/yt-dlp
fi

echo "==> [4/8] Clone / update repo..."
mkdir -p /var/www
if [[ ! -d "${APP_DIR}/.git" ]]; then
  git clone "${REPO}" "${APP_DIR}"
else
  git -C "${APP_DIR}" pull
fi
cd "${APP_DIR}"

echo "==> [5/8] PostgreSQL database..."
DB_PASS="$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)"
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='hellodownloader'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER hellodownloader WITH PASSWORD '${DB_PASS}';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='hellodownloader'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE hellodownloader OWNER hellodownloader;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE hellodownloader TO hellodownloader;" 2>/dev/null || true

if [[ ! -f .env ]]; then
  cp deploy/env.hellodownloader.example .env
  JWT1="$(openssl rand -base64 48)"
  JWT2="$(openssl rand -base64 48)"
  sed -i "s|CHANGE_ME_DB_PASSWORD|${DB_PASS}|g" .env
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${JWT1}|" .env
  sed -i "s|^JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=${JWT2}|" .env
  ADMIN_PASS="$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9!@#' | head -c 16)"
  sed -i "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=${ADMIN_PASS}|" .env
  sed -i "s|^ADMIN_EMAIL=.*|ADMIN_EMAIL=admin@hellodownloader.com|" .env
  chmod 600 .env
  echo "ADMIN_EMAIL=admin@hellodownloader.com" > /root/hellodownloader-admin.txt
  echo "ADMIN_PASSWORD=${ADMIN_PASS}" >> /root/hellodownloader-admin.txt
  echo "DATABASE_URL password: ${DB_PASS}" >> /root/hellodownloader-admin.txt
  chmod 600 /root/hellodownloader-admin.txt
  echo "Credentials saved: /root/hellodownloader-admin.txt"
fi

echo "==> [6/8] Build app..."
# Skip postinstall db:push — production uses migrate deploy (avoids Prisma P3005)
pnpm install --ignore-scripts --frozen-lockfile 2>/dev/null || pnpm install --ignore-scripts
pnpm db:generate
pnpm --filter @hellodownloader/shared-types build
pnpm --filter @hellodownloader/config build
pnpm --filter @hellodownloader/auth-utils build
pnpm --filter @hellodownloader/queue-utils build
cp .env apps/web/.env.production
pnpm --filter @hellodownloader/api build
pnpm --filter @hellodownloader/web build
pnpm db:migrate:deploy
mkdir -p storage/downloads storage/playlists storage/thumbnails storage/branding

echo "==> [7/8] Nginx + firewall..."
cp deploy/nginx.hellodownloader.conf /etc/nginx/sites-available/hellodownloader
ln -sf /etc/nginx/sites-available/hellodownloader /etc/nginx/sites-enabled/hellodownloader
nginx -t
systemctl enable nginx
systemctl restart nginx
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo "==> [8/8] PM2 + admin..."
pm2 delete all 2>/dev/null || true
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null | tail -1 | bash || true
node scripts/create-admin.mjs || true

echo ""
echo "============================================"
echo " BOOTSTRAP DONE"
echo " http://hellodownloader.com should work now"
echo " Admin login: cat /root/hellodownloader-admin.txt"
echo " SSL: certbot --nginx -d hellodownloader.com -d www.hellodownloader.com -d api.hellodownloader.com"
echo "============================================"
