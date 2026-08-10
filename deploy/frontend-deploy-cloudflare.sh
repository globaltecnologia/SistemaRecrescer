#!/usr/bin/env bash
set -Eeuo pipefail
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"
load_config

require_command npx
require_command jq

CLOUDFLARE_PAGES_PROJECT="${CLOUDFLARE_PAGES_PROJECT:-sistema-recrescer}"
CLOUDFLARE_PRODUCTION_BRANCH="${CLOUDFLARE_PRODUCTION_BRANCH:-main}"
WRANGLER_VERSION="${WRANGLER_VERSION:-4.120.0}"

if [[ "${1:-}" != "--skip-build" ]]; then
  "${DEPLOY_DIR}/frontend-build.sh"
fi

cd "${PROJECT_ROOT}"
projects_json="$(npx --yes "wrangler@${WRANGLER_VERSION}" pages project list --json)" || \
  die "Cloudflare não autenticada; execute: npx wrangler login"

if ! jq -e --arg name "${CLOUDFLARE_PAGES_PROJECT}" \
  '.[] | select((.name // .["Project Name"]) == $name)' <<<"${projects_json}" >/dev/null; then
  log "criando projeto Cloudflare Pages ${CLOUDFLARE_PAGES_PROJECT}"
  npx --yes "wrangler@${WRANGLER_VERSION}" pages project create \
    "${CLOUDFLARE_PAGES_PROJECT}" \
    --production-branch "${CLOUDFLARE_PRODUCTION_BRANCH}"
fi

log "publicando frontend no Cloudflare Pages"
npx --yes "wrangler@${WRANGLER_VERSION}" pages deploy dist \
  --project-name "${CLOUDFLARE_PAGES_PROJECT}" \
  --branch "${CLOUDFLARE_PRODUCTION_BRANCH}" \
  --commit-dirty=true
