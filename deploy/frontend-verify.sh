#!/usr/bin/env bash
set -Eeuo pipefail
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"
load_config

require_command curl

CLOUDFLARE_PAGES_PROJECT="${CLOUDFLARE_PAGES_PROJECT:-sistema-recrescer}"
CLOUDFLARE_PAGES_DOMAIN="${CLOUDFLARE_PAGES_DOMAIN:-${CLOUDFLARE_PAGES_PROJECT}.pages.dev}"
site_url="https://${CLOUDFLARE_PAGES_DOMAIN}"

log "testando ${site_url}"
curl --fail --silent --show-error --location "${site_url}" | grep -q '<div id="root"></div>'
printf '%s\n' "${site_url}"
