#!/usr/bin/env bash
# HelloDownloader — Ubuntu VPS first-time setup
# Run as root on a fresh Ubuntu 22.04/24.04 server:
#   curl -fsSL ... OR clone repo then:
#   sudo bash deploy/setup-vps.sh
#
# Optional env vars before running:
#   DOMAIN=hellodownloader.com
#   APP_DIR=/var/www/hellodownloader
#   DB_PASS=your-db-password
#   GIT_REPO=https://github.com/themepuls/hellodownloader.git

set -euo pipefail

DOMAIN="${DOMAIN:-}"
APP_DIR="${APP_DIR:-/var/www/hellodownloader}"
DB_PASS="${DB_PASS:-$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)}"
GIT_REPO="${GIT_REPO:-https://github.com/themepuls/hellodownloader.git}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash deploy/setup-vps.sh"
  exit 1
fi

echo "==> Updating system packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y

echo "==> Installing base packages..."
apt-get install -y \
  curl git ca-certificates gnupg build-essential \
  nginx redis-server postgresql postgresql-contrib \
  ffmpeg certbot python3-certbot-nginx \
  ufw

echo "==> Installing yt-dlp..."
if ! command -v yt-dlp >/dev/null 2>&1; then
  curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
  chmod a+rx /usr/local/bin/yt-dlp
fi

echo "==> Installing Node.js 20..."
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo "==> Installing pnpm + PM2..."
npm install -g pnpm@9 pm2

echo "==> Configuring PostgreSQL..."
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='hellodownloader'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER hellodownloader WITH PASSWORD '${DB_PASS}';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='hellodownloader'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE hellodownloader OWNER hellodownloader;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE hellodownloader TO hellodownloader;"

echo "==> Enabling Redis..."
systemctl enable --now redis-server

echo "==> Cloning app to ${APP_DIR}..."
if [[ ! -d "${APP_DIR}/.git" ]]; then
  mkdir -p "$(dirname "${APP_DIR}")"
  git clone "${GIT_REPO}" "${APP_DIR}"
fi

cd "${APP_DIR}"

if [[ ! -f .env ]]; then
  echo "==> Creating .env from template..."
  if [[ -f deploy/env.hellodownloader.example ]]; then
    cp deploy/env.hellodownloader.example .env
  else
    cp deploy/env.production.example .env
  fi
  JWT1="$(openssl rand -base64 48)"
  JWT2="$(openssl rand -base64 48)"
  sed -i "s|CHANGE_ME_DB_PASSWORD|${DB_PASS}|g" .env
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${JWT1}|" .env
  sed -i "s|^JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=${JWT2}|" .env
  if [[ -n "${DOMAIN}" ]]; then
    sed -i "s|YOUR_DOMAIN|${DOMAIN}|g" .env
  fi
  echo ""
  echo ">>> Edit ${APP_DIR}/.env — set DOMAIN, ADMIN_EMAIL, ADMIN_PASSWORD, payment keys"
  echo ">>> DB password saved in .env (user: hellodownloader)"
fi

echo "==> Installing dependencies & building..."
pnpm install --frozen-lockfile 2>/dev/null || pnpm install
pnpm db:generate
pnpm --filter @hellodownloader/shared-types build
pnpm --filter @hellodownloader/config build
pnpm --filter @hellodownloader/auth-utils build
pnpm --filter @hellodownloader/queue-utils build

# Next.js needs NEXT_PUBLIC_* at build time
set -a
source .env
set +a
cp .env apps/web/.env.production

pnpm --filter @hellodownloader/api build
pnpm --filter @hellodownloader/web build

echo "==> Running database migrations..."
pnpm db:migrate:deploy

echo "==> Creating storage dirs..."
mkdir -p storage/downloads storage/playlists storage/thumbnails storage/branding

echo "==> Creating admin user (set ADMIN_PASSWORD in .env first)..."
if grep -q '^ADMIN_PASSWORD=Choose-A-Strong-Password-Here' .env 2>/dev/null; then
  echo "Skip admin — set ADMIN_PASSWORD in .env then run: node scripts/create-admin.mjs"
else
  node scripts/create-admin.mjs || true
fi

echo "==> Starting PM2..."
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup systemd -u root --hp /root || true

if [[ -n "${DOMAIN}" ]]; then
  echo "==> Configuring Nginx for ${DOMAIN}..."
  if [[ -f deploy/nginx.hellodownloader.conf && "${DOMAIN}" == "hellodownloader.com" ]]; then
    cp deploy/nginx.hellodownloader.conf /etc/nginx/sites-available/hellodownloader
  else
    sed "s/YOUR_DOMAIN/${DOMAIN}/g" deploy/nginx.site.conf.example > /etc/nginx/sites-available/hellodownloader
  fi
  ln -sf /etc/nginx/sites-available/hellodownloader /etc/nginx/sites-enabled/hellodownloader
  nginx -t && systemctl reload nginx

  echo "==> SSL (optional — DNS must point to this server first)..."
  echo "Run: certbot --nginx -d hellodownloader.com -d www.hellodownloader.com -d api.hellodownloader.com"
fi

echo "==> Firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo ""
echo "============================================"
echo " Setup complete!"
echo " App dir:    ${APP_DIR}"
echo " DB pass:    (in .env)"
echo " API:        http://127.0.0.1:4001/api/v1"
echo " Web:        http://127.0.0.1:3000"
if [[ -n "${DOMAIN}" ]]; then
  echo " Site:       http://${DOMAIN}"
  echo " HTTPS:      certbot --nginx -d ${DOMAIN}"
else
  echo " Set DOMAIN=yourdomain.com and re-run nginx section, or edit .env URLs"
fi
echo " PM2:        pm2 status"
echo " Logs:       pm2 logs hd-api"
echo " Reboot:     recommended after kernel upgrade"
echo "============================================"
