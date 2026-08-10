#!/usr/bin/env bash

set -Eeuo pipefail

DEPLOY_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_ROOT="$(cd -- "${DEPLOY_DIR}/.." && pwd)"
CONFIG_FILE="${DEPLOY_CONFIG_FILE:-${DEPLOY_DIR}/config.env}"

AWS_PROFILE="${AWS_PROFILE:-recrescer}"
AWS_REGION="${AWS_REGION:-us-west-2}"
APP_NAME="${APP_NAME:-sistema-recrescer}"
ENVIRONMENT="${ENVIRONMENT:-prod}"
SAM_STACK_NAME="${SAM_STACK_NAME:-${APP_NAME}-${ENVIRONMENT}}"
LAMBDA_FUNCTION="${LAMBDA_FUNCTION:-${APP_NAME}-${ENVIRONMENT}-api}"

log() { printf '[deploy] %s\n' "$*"; }
die() { printf '[deploy] ERRO: %s\n' "$*" >&2; exit 1; }
require_command() { command -v "$1" >/dev/null 2>&1 || die "comando obrigatório ausente: $1"; }

load_config() {
  if [[ -f "${CONFIG_FILE}" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "${CONFIG_FILE}"
    set +a
  fi
}

require_config() {
  local variable
  for variable in "$@"; do
    [[ -n "${!variable:-}" ]] || die "defina ${variable} em ${CONFIG_FILE}"
  done
}

aws_cli() {
  aws --profile "${AWS_PROFILE}" --region "${AWS_REGION}" --no-cli-pager "$@"
}

caller_arn() {
  aws_cli sts get-caller-identity --query Arn --output text
}

account_id() {
  aws_cli sts get-caller-identity --query Account --output text
}

stack_output() {
  local key="$1"
  aws_cli cloudformation describe-stacks \
    --stack-name "${SAM_STACK_NAME}" \
    --query "Stacks[0].Outputs[?OutputKey=='${key}'].OutputValue | [0]" \
    --output text
}
