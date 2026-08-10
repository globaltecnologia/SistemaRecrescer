#!/usr/bin/env bash
set -Eeuo pipefail
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"
load_config

require_command sam
require_command docker

cd "${PROJECT_ROOT}"
log "validando template SAM"
sam validate --lint --template-file deploy/template.yaml --region "${AWS_REGION}"

log "construindo imagem Lambda x86_64"
sam build \
  --template-file deploy/template.yaml \
  --build-dir .aws-sam/build \
  --parameter-overrides "FunctionName=${LAMBDA_FUNCTION}"
