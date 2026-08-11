#!/usr/bin/env bash
set -Eeuo pipefail
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"
load_config

require_command sam
require_config MYSQL_HOST MYSQL_PORT MYSQL_DATABASE MYSQL_USER MYSQL_PASSWORD MYSQL_SSL_MODE ADMIN_LOGIN ADMIN_PASSWORD CORS_ORIGIN

if [[ "${1:-}" != "--skip-build" ]]; then
  "${DEPLOY_DIR}/build.sh"
fi

cd "${PROJECT_ROOT}"
log "implantando stack ${SAM_STACK_NAME}"
sam deploy \
  --template-file .aws-sam/build/template.yaml \
  --stack-name "${SAM_STACK_NAME}" \
  --profile "${AWS_PROFILE}" \
  --region "${AWS_REGION}" \
  --resolve-s3 \
  --resolve-image-repos \
  --capabilities CAPABILITY_IAM \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset \
  --parameter-overrides \
    "FunctionName=${LAMBDA_FUNCTION}" \
    "MysqlHost=${MYSQL_HOST}" \
    "MysqlPort=${MYSQL_PORT}" \
    "MysqlDatabase=${MYSQL_DATABASE}" \
    "MysqlUser=${MYSQL_USER}" \
    "MysqlPassword=${MYSQL_PASSWORD}" \
    "MysqlSslMode=${MYSQL_SSL_MODE}" \
    $( [ -n "${MYSQL_SSL_CA_BASE64:-}" ] && echo "MysqlSslCaBase64=${MYSQL_SSL_CA_BASE64}" ) \
    "AdminLogin=${ADMIN_LOGIN}" \
    "AdminPassword=${ADMIN_PASSWORD}" \
    "CorsOrigin=${CORS_ORIGIN}" \
    "ReservedConcurrency=${LAMBDA_RESERVED_CONCURRENCY:-10}"
