#!/usr/bin/env bash
set -Eeuo pipefail
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"
load_config

require_command npm
require_command aws

api_url="${FRONTEND_API_URL:-$(stack_output ApiFunctionUrl)}"
[[ -n "${api_url}" && "${api_url}" != "None" ]] || die "URL da API não encontrada na stack ${SAM_STACK_NAME}"

cd "${PROJECT_ROOT}"
log "construindo frontend para ${api_url%/}"
VITE_API_BASE_URL="${api_url%/}" npm run build
test -f dist/index.html || die "build não gerou dist/index.html"
log "frontend construído em ${PROJECT_ROOT}/dist"
