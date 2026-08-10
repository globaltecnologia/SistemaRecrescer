#!/usr/bin/env bash
set -Eeuo pipefail
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"
load_config

require_command aws
require_command docker
require_command git
require_command node
require_command npm
require_command sam

arn="$(caller_arn)"
[[ "${arn}" != *":root" ]] || die "deploy com root não é permitido"
docker info >/dev/null 2>&1 || die "Docker não está acessível"

log "projeto: ${PROJECT_ROOT}"
log "perfil: ${AWS_PROFILE}"
log "região: ${AWS_REGION}"
log "identidade: ${arn}"
log "conta: $(account_id)"
log "stack: ${SAM_STACK_NAME}"
log "função: ${LAMBDA_FUNCTION}"

if [[ ! -f "${CONFIG_FILE}" ]]; then
  log "configuração de deploy ainda não criada: cp deploy/config.env.example deploy/config.env"
fi
