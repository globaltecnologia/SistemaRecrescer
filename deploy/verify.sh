#!/usr/bin/env bash
set -Eeuo pipefail
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"
load_config

require_command curl
function_url="$(stack_output ApiFunctionUrl)"
[[ "${function_url}" == https://* ]] || die "Function URL não encontrada na stack"

log "testando ${function_url}api/health"
curl --fail --silent --show-error --retry 5 --retry-delay 3 \
  "${function_url}api/health"
printf '\n'
