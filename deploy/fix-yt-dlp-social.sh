#!/usr/bin/env bash
# Update yt-dlp + curl_cffi for Facebook, Instagram, TikTok impersonation on VPS.
# Run: cd /var/www/hellodownloader && sudo bash deploy/fix-yt-dlp-social.sh

set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/hellodownloader}"
ENV_FILE="${APP_DIR}/.env"

echo "==> Install curl_cffi (browser impersonation for social downloads)..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y >/dev/null 2>&1 || true
apt-get install -y python3-pip python3-venv >/dev/null 2>&1 || true
pip3 install -U "curl_cffi>=0.7" 2>/dev/null || pip3 install -U curl_cffi || true

echo "==> Install latest yt-dlp (Linux standalone with bundled deps)..."
curl -fsSL "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux" -o /usr/local/bin/yt-dlp
chmod a+rx /usr/local/bin/yt-dlp
ln -sf /usr/local/bin/yt-dlp /usr/bin/yt-dlp 2>/dev/null || true

echo "==> Verify yt-dlp..."
yt-dlp --version
yt-dlp --list-impersonate-targets 2>/dev/null | head -8 || echo "(impersonate targets need curl_cffi — pip install above)"

if [[ -f "${ENV_FILE}" ]]; then
  grep -q '^YT_DLP_IMPERSONATE=' "${ENV_FILE}" || echo 'YT_DLP_IMPERSONATE=chrome' >> "${ENV_FILE}"
  grep -q '^YT_DLP_PATH=' "${ENV_FILE}" || echo 'YT_DLP_PATH=/usr/local/bin/yt-dlp' >> "${ENV_FILE}"
  sed -i 's|^YT_DLP_PATH=.*|YT_DLP_PATH=/usr/local/bin/yt-dlp|' "${ENV_FILE}" 2>/dev/null || true
fi

mkdir -p "${APP_DIR}/storage"

echo ""
echo "==> Optional: Facebook / Instagram cookies"
echo "    Admin → Storage → upload cookies.txt (Netscape format from browser extension)"
echo "    Or: scp cookies.txt root@YOUR_VPS:${APP_DIR}/storage/cookies.txt"
echo ""
echo "==> Restart API..."
if command -v pm2 >/dev/null 2>&1; then
  pm2 restart hd-api 2>/dev/null || pm2 restart all
  pm2 status
fi

echo ""
echo "Done. Test: YouTube + TikTok (vm.tiktok.com links). FB/IG need cookies.txt on server."
