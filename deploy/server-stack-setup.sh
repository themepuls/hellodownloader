#!/usr/bin/env bash
# HelloDownloader — Ubuntu 24.04 server stack setup (safe, idempotent)
# Run on the VPS as root:
#   sudo bash deploy/server-stack-setup.sh
#
# Optional env (no passwords prompted):
#   DOMAIN=yourdomain.com          — for Nginx server_name
#   APP_DIR=/var/www/hellodownloader
#   NODE_MAJOR=20

set -euo pipefail

DOMAIN="${DOMAIN:-}"
APP_DIR="${APP_DIR:-/var/www/hellodownloader}"
NODE_MAJOR="${NODE_MAJOR:-20}"
DB_NAME="${DB_NAME:-hellodownloader}"
DB_USER="${DB_NAME}"
CREDS_FILE="${APP_DIR}/.generated-db-credentials"

step=0
run() {
  step=$((step + 1))
  echo ""
  echo "============================================================"
  echo " STEP ${step}: $1"
  echo "============================================================"
  echo "\$ $2"
  eval "$2"
  echo ""
}

warn() { echo "WARNING: $*" >&2; }
die()  { echo "CRITICAL: $*" >&2; exit 1; }

require_root() {
  if [[ "$(id -u)" -ne 0 ]]; then
    die "Run as root: sudo bash deploy/server-stack-setup.sh"
  fi
}

apt_updated=false
ensure_apt() {
  if [[ "$apt_updated" == false ]]; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y
    apt_updated=true
  fi
}

install_pkg() {
  local pkg="$1"
  if dpkg -s "$pkg" >/dev/null 2>&1; then
    echo "Already installed: $pkg"
  else
    ensure_apt
    apt-get install -y "$pkg"
  fi
}

require_root

echo "HelloDownloader server stack setup — Ubuntu $(lsb_release -rs 2>/dev/null || echo unknown)"
echo "Started: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"

# --- 1. Node.js ---
run "Verify Node.js" "node -v 2>/dev/null || echo 'node: not installed'"
if ! command -v node >/dev/null 2>&1; then
  step=$((step + 1))
  echo ""
  echo "============================================================"
  echo " STEP ${step}: Install Node.js ${NODE_MAJOR}.x"
  echo "============================================================"
  ensure_apt
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
  echo ""
fi
NODE_V="$(node -v | tr -d v | cut -d. -f1)"
if [[ "${NODE_V}" -lt "${NODE_MAJOR}" ]]; then
  die "Node.js $(node -v) is below required major version ${NODE_MAJOR}"
fi
run "Node.js version (verified)" "node -v"

# --- 2. npm ---
run "Verify npm" "npm -v 2>/dev/null || die 'npm missing after Node install'"
if ! command -v npm >/dev/null 2>&1; then
  die "npm is not installed — Node.js install may have failed"
fi

# --- 3. PM2 ---
run "Verify PM2" "pm2 -v 2>/dev/null || echo 'pm2: not installed'"
if ! command -v pm2 >/dev/null 2>&1; then
  run "Install PM2 globally" "npm install -g pm2"
fi
run "PM2 version (verified)" "pm2 -v"

# --- 4. PostgreSQL ---
run "Verify PostgreSQL client" "psql --version 2>/dev/null || echo 'postgresql: not installed'"
if ! command -v psql >/dev/null 2>&1; then
  install_pkg postgresql
  install_pkg postgresql-contrib
fi
systemctl enable postgresql
systemctl start postgresql
run "PostgreSQL service" "systemctl is-active postgresql"

if ! sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1; then
  DB_PASS="$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)"
  step=$((step + 1))
  echo ""
  echo "============================================================"
  echo " STEP ${step}: Create PostgreSQL role ${DB_USER}"
  echo "============================================================"
  sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
  mkdir -p "${APP_DIR}"
  printf 'DB_USER=%s\nDB_NAME=%s\nDB_PASS=%s\nDATABASE_URL=postgresql://%s:%s@localhost:5432/%s\n' \
    "${DB_USER}" "${DB_NAME}" "${DB_PASS}" \
    "${DB_USER}" "${DB_PASS}" "${DB_NAME}" > "${CREDS_FILE}"
  chmod 600 "${CREDS_FILE}"
  echo "Database credentials written to: ${CREDS_FILE}"
  echo ""
else
  echo "PostgreSQL role '${DB_USER}' already exists — skipped create"
fi

if ! sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  step=$((step + 1))
  echo ""
  echo "============================================================"
  echo " STEP ${step}: Create PostgreSQL database ${DB_NAME}"
  echo "============================================================"
  sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
  sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"
  echo ""
else
  echo "Database '${DB_NAME}' already exists — skipped create"
fi

# --- 5. Redis ---
run "Verify Redis" "redis-server --version 2>/dev/null || echo 'redis: not installed'"
if ! command -v redis-server >/dev/null 2>&1; then
  run "Install Redis" "install_pkg redis-server"
fi
systemctl enable redis-server
systemctl start redis-server
run "Redis ping" "redis-cli ping"

# --- 6. FFmpeg ---
run "Verify FFmpeg" "ffmpeg -version 2>/dev/null | head -1 || echo 'ffmpeg: not installed'"
if ! command -v ffmpeg >/dev/null 2>&1; then
  run "Install FFmpeg" "install_pkg ffmpeg"
fi
run "FFmpeg version (verified)" "ffmpeg -version | head -1"

# --- 7. yt-dlp ---
run "Verify yt-dlp" "yt-dlp --version 2>/dev/null || echo 'yt-dlp: not installed'"
if ! command -v yt-dlp >/dev/null 2>&1; then
  run "Install yt-dlp" "
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
    chmod a+rx /usr/local/bin/yt-dlp
  "
fi
run "yt-dlp version (verified)" "yt-dlp --version"

# --- 8. Nginx ---
run "Verify Nginx" "nginx -v 2>&1 || echo 'nginx: not installed'"
if ! command -v nginx >/dev/null 2>&1; then
  run "Install Nginx" "install_pkg nginx"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NGINX_TEMPLATE="${SCRIPT_DIR}/nginx.site.conf.example"
NGINX_SITE="/etc/nginx/sites-available/hellodownloader"

if [[ -f "${NGINX_TEMPLATE}" ]]; then
  SERVER_NAME="${DOMAIN:-_}"
  run "Configure Nginx site (server_name=${SERVER_NAME})" "
    sed \"s/YOUR_DOMAIN/${SERVER_NAME}/g\" \"${NGINX_TEMPLATE}\" > \"${NGINX_SITE}\"
    ln -sf \"${NGINX_SITE}\" /etc/nginx/sites-enabled/hellodownloader
    nginx -t
    systemctl enable nginx
    systemctl reload nginx
  "
else
  warn "Nginx template not found at ${NGINX_TEMPLATE} — skip site config"
fi

run "Nginx service" "systemctl is-active nginx"

# --- 9. pnpm (needed for HelloDownloader) ---
run "Verify pnpm" "pnpm -v 2>/dev/null || echo 'pnpm: not installed'"
if ! command -v pnpm >/dev/null 2>&1; then
  run "Install pnpm" "npm install -g pnpm@9"
fi
run "pnpm version (verified)" "pnpm -v"

# --- 10. Deployment-ready environment ---
run "Prepare app directory" "mkdir -p \"${APP_DIR}/storage/downloads\" \"${APP_DIR}/storage/playlists\" \"${APP_DIR}/storage/thumbnails\" \"${APP_DIR}/storage/branding\""

if [[ ! -f "${APP_DIR}/.env" && -f "${SCRIPT_DIR}/env.production.example" ]]; then
  run "Create .env from production template" "
    cp \"${SCRIPT_DIR}/env.production.example\" \"${APP_DIR}/.env\"
    JWT1=\$(openssl rand -base64 48)
    JWT2=\$(openssl rand -base64 48)
    sed -i \"s|^JWT_SECRET=.*|JWT_SECRET=\${JWT1}|\" \"${APP_DIR}/.env\"
    sed -i \"s|^JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=\${JWT2}|\" \"${APP_DIR}/.env\"
  "
  if [[ -f "${CREDS_FILE}" ]]; then
    # shellcheck disable=SC1090
    source "${CREDS_FILE}"
    sed -i "s|CHANGE_ME_DB_PASSWORD|${DB_PASS}|g" "${APP_DIR}/.env"
    sed -i "s|postgresql://hellodownloader:CHANGE_ME_DB_PASSWORD@|postgresql://${DB_USER}:${DB_PASS}@|g" "${APP_DIR}/.env" || true
  fi
  if [[ -n "${DOMAIN}" ]]; then
    sed -i "s|YOUR_DOMAIN|${DOMAIN}|g" "${APP_DIR}/.env"
  fi
  chmod 600 "${APP_DIR}/.env"
  echo ".env created at ${APP_DIR}/.env — edit ADMIN_EMAIL, ADMIN_PASSWORD, DOMAIN URLs before deploy"
fi

# --- Verification block ---
echo ""
echo "============================================================"
echo " VERIFICATION SUMMARY"
echo "============================================================"
run "node -v" "node -v"
run "npm -v" "npm -v"
run "pm2 status" "pm2 status || pm2 list || echo 'PM2 installed (no apps yet)'"
run "systemctl status nginx (short)" "systemctl status nginx --no-pager -l | head -15"
run "systemctl status postgresql (short)" "systemctl status postgresql --no-pager -l | head -15"
run "systemctl status redis-server (short)" "systemctl status redis-server --no-pager -l | head -15"
run "ffmpeg -version" "ffmpeg -version | head -1"
run "yt-dlp --version" "yt-dlp --version"

echo ""
echo "============================================================"
echo " SERVER STACK READY"
echo "============================================================"
echo " App dir:     ${APP_DIR}"
echo " Next steps:"
echo "   1. Clone repo:  git clone https://github.com/themepuls/hellodownloader.git ${APP_DIR}"
echo "   2. Or copy .env into cloned repo and run: bash deploy/setup-vps.sh"
echo "   3. Or from repo root: bash deploy/redeploy.sh && pm2 start deploy/ecosystem.config.cjs"
if [[ -f "${CREDS_FILE}" ]]; then
  echo " DB creds:    ${CREDS_FILE} (chmod 600)"
fi
if [[ -n "${DOMAIN}" ]]; then
  echo " SSL:         certbot --nginx -d ${DOMAIN}"
fi
echo " Completed:   $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "============================================================"
