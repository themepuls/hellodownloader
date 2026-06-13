#!/usr/bin/env bash
# Fix API 500 — nginx proxies /api/v1 directly to NestJS (port 4001).
# Run: cd /var/www/hellodownloader && sudo bash deploy/fix-api-proxy.sh

set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/hellodownloader}"
SNIPPET_SRC="${APP_DIR}/deploy/nginx-hd-locations.conf"
SNIPPET_DST="/etc/nginx/snippets/hellodownloader-hd-locations.conf"
SITE="/etc/nginx/sites-available/hellodownloader"

if [[ ! -f "${SNIPPET_SRC}" ]]; then
  echo "CRITICAL: Missing ${SNIPPET_SRC} — run git pull first"
  exit 1
fi

mkdir -p "${APP_DIR}/apps/web/public/uploads"
mkdir -p /etc/nginx/snippets

sed "s|/var/www/hellodownloader|${APP_DIR}|g" "${SNIPPET_SRC}" > "${SNIPPET_DST}"

if [[ ! -f "${SITE}" ]]; then
  echo "CRITICAL: Missing ${SITE} — run deploy/fix-ssl.sh or vps-bootstrap first"
  exit 1
fi

echo "==> Remove duplicate location blocks from site config..."
python3 <<'PY'
import re
from pathlib import Path

site = Path("/etc/nginx/sites-available/hellodownloader")
text = site.read_text()

def strip_location_blocks(source: str, prefix: str) -> str:
    pattern = re.compile(
        rf"[ \t]*location {re.escape(prefix)}[^\{{]*\{{",
        re.MULTILINE,
    )
    out = []
    i = 0
    while i < len(source):
        m = pattern.search(source, i)
        if not m:
            out.append(source[i:])
            break
        out.append(source[i : m.start()])
        depth = 0
        j = m.start()
        while j < len(source):
            if source[j] == "{":
                depth += 1
            elif source[j] == "}":
                depth -= 1
                if depth == 0:
                    j += 1
                    break
            j += 1
        i = j
    return "".join(out)

for loc in ("/uploads/", "/api/v1/"):
    text = strip_location_blocks(text, loc)

site.write_text(text)
print("Removed old /uploads/ and /api/v1/ blocks from site file")
PY

INCLUDE='include /etc/nginx/snippets/hellodownloader-hd-locations.conf;'

if ! grep -q 'hellodownloader-hd-locations.conf' "${SITE}"; then
  sed -i "/server_name hellodownloader.com;/a\\    ${INCLUDE}" "${SITE}"
  echo "Added nginx include for API + uploads"
else
  echo "Nginx include already present"
fi

if ! grep -q 'client_header_buffer_size 32k' "${SITE}"; then
  sed -i '/server_name hellodownloader.com;/a\    client_header_buffer_size 32k;\n    large_client_header_buffers 4 32k;' "${SITE}"
fi

nginx -t
systemctl reload nginx

echo ""
echo "==> Tests..."
sleep 1
API=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 https://hellodownloader.com/api/v1/ads/config 2>/dev/null || echo 000)
HDR=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 https://hellodownloader.com/api/v1/content/pages/header 2>/dev/null || echo 000)
echo "  /api/v1/ads/config          → ${API}"
echo "  /api/v1/content/pages/header → ${HDR}"
if [[ "${API}" == "200" && "${HDR}" == "200" ]]; then
  echo ""
  echo "Fixed. Hard refresh https://hellodownloader.com"
else
  echo ""
  echo "If still failing:"
  echo "  pm2 status"
  echo "  pm2 logs hd-api --lines 30"
  echo "  curl -s http://127.0.0.1:4001/api/v1/ads/config"
fi
