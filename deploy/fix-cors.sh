#!/usr/bin/env bash
# Fix CORS errors — browser must call /api/v1 on main domain, not api.hellodownloader.com
# Run on VPS: cd /var/www/hellodownloader && sudo bash deploy/fix-cors.sh

set -euo pipefail
exec "$(dirname "$0")/fix-login.sh"
