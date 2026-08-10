#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

require_command avn
require_command jq
require_command base64
require_command openssl

load_config

AIVEN_PROJECT="${AIVEN_PROJECT:-recrescer}"
AIVEN_SERVICE="${AIVEN_SERVICE:-recrescer-mysql}"
AIVEN_CLOUD="${AIVEN_CLOUD:-do-nyc}"
AIVEN_PLAN="${AIVEN_PLAN:-free-1-1gb}"
MYSQL_DATABASE="${MYSQL_DATABASE:-recrescer}"
MYSQL_USER="${MYSQL_USER:-recrescer_app}"

if ! avn user info >/dev/null 2>&1; then
  die "Aiven CLI não autenticado; execute: avn user login"
fi

if ! avn project list --json | jq -e --arg project "${AIVEN_PROJECT}" \
  '.[] | select(.project_name == $project)' >/dev/null; then
  die "projeto Aiven não encontrado: ${AIVEN_PROJECT}"
fi

if avn service get "${AIVEN_SERVICE}" --project "${AIVEN_PROJECT}" --json \
  >/dev/null 2>&1; then
  log "Serviço Aiven já existe: ${AIVEN_SERVICE}"
else
  log "Criando MySQL Aiven ${AIVEN_SERVICE} (${AIVEN_PLAN}, ${AIVEN_CLOUD})"
  avn service create "${AIVEN_SERVICE}" \
    --project "${AIVEN_PROJECT}" \
    --service-type mysql \
    --plan "${AIVEN_PLAN}" \
    --cloud "${AIVEN_CLOUD}" \
    --enable-termination-protection \
    --no-fail-if-exists
fi

log "Aguardando o MySQL ficar disponível"
avn service wait "${AIVEN_SERVICE}" --project "${AIVEN_PROJECT}" --timeout 900

if ! avn service database-list "${AIVEN_SERVICE}" --project "${AIVEN_PROJECT}" \
  --json | jq -e --arg database "${MYSQL_DATABASE}" \
  '.[] | select((if type == "object" then .database_name else . end) == $database)' \
  >/dev/null; then
  log "Criando banco ${MYSQL_DATABASE}"
  avn service database-create "${AIVEN_SERVICE}" \
    --project "${AIVEN_PROJECT}" --dbname "${MYSQL_DATABASE}" >/dev/null
fi

if ! avn service user-list "${AIVEN_SERVICE}" --project "${AIVEN_PROJECT}" \
  --json | jq -e --arg username "${MYSQL_USER}" \
  '.[] | select(.username == $username)' >/dev/null; then
  log "Criando usuário ${MYSQL_USER}"
  avn service user-create "${AIVEN_SERVICE}" \
    --project "${AIVEN_PROJECT}" --username "${MYSQL_USER}" >/dev/null
fi

service_json="$(avn service get "${AIVEN_SERVICE}" --project "${AIVEN_PROJECT}" --json)"

MYSQL_HOST="$(jq -er '.connection_info.mysql[0].host // .service_uri_params.host' <<<"${service_json}")"
MYSQL_PORT="$(jq -er '.connection_info.mysql[0].port // .service_uri_params.port' <<<"${service_json}")"
# Consultas posteriores mascaram a senha como **********. Definimos uma senha
# local estável, preservada em config.env nas próximas execuções.
if [[ -z "${MYSQL_PASSWORD:-}" || "${MYSQL_PASSWORD}" == '**********' ]]; then
  MYSQL_PASSWORD="$(openssl rand -hex 24)"
fi
avn service user-password-reset "${AIVEN_SERVICE}" \
  --project "${AIVEN_PROJECT}" --username "${MYSQL_USER}" \
  --new-password "${MYSQL_PASSWORD}" >/dev/null

ca_file="$(mktemp)"
trap 'rm -f -- "${ca_file}"' EXIT
avn project ca-get --project "${AIVEN_PROJECT}" --target-filepath "${ca_file}" >/dev/null
MYSQL_SSL_CA_BASE64="$(base64 -w0 "${ca_file}")"

ADMIN_PASSWORD="${ADMIN_PASSWORD:-$(openssl rand -base64 30 | tr -d '\n')}"

umask 077
{
  printf '# Gerado por deploy/provision-mysql-aiven.sh. Não versionar.\n\n'
  printf 'AWS_PROFILE=%q\n' "${AWS_PROFILE}"
  printf 'AWS_REGION=%q\n' "${AWS_REGION}"
  printf 'APP_NAME=%q\n' "${APP_NAME}"
  printf 'ENVIRONMENT=%q\n' "${ENVIRONMENT}"
  printf 'LAMBDA_RESERVED_CONCURRENCY=%q\n' "${LAMBDA_RESERVED_CONCURRENCY:-10}"
  printf 'AIVEN_PROJECT=%q\n' "${AIVEN_PROJECT}"
  printf 'AIVEN_SERVICE=%q\n' "${AIVEN_SERVICE}"
  printf 'AIVEN_CLOUD=%q\n' "${AIVEN_CLOUD}"
  printf 'AIVEN_PLAN=%q\n' "${AIVEN_PLAN}"
  printf 'MYSQL_HOST=%q\n' "${MYSQL_HOST}"
  printf 'MYSQL_PORT=%q\n' "${MYSQL_PORT}"
  printf 'MYSQL_DATABASE=%q\n' "${MYSQL_DATABASE}"
  printf 'MYSQL_USER=%q\n' "${MYSQL_USER}"
  printf 'MYSQL_PASSWORD=%q\n' "${MYSQL_PASSWORD}"
  printf 'MYSQL_SSL_MODE=required\n'
  printf 'MYSQL_SSL_CA_BASE64=%q\n' "${MYSQL_SSL_CA_BASE64}"
  printf 'ADMIN_LOGIN=%q\n' "${ADMIN_LOGIN:-admin}"
  printf 'ADMIN_PASSWORD=%q\n' "${ADMIN_PASSWORD}"
  printf 'CORS_ORIGIN=%q\n' "${CORS_ORIGIN:-*}"
} >"${CONFIG_FILE}"
chmod 600 "${CONFIG_FILE}"

log "Configuração gravada com segurança em ${CONFIG_FILE}"
log "MySQL Aiven pronto: ${AIVEN_SERVICE}/${MYSQL_DATABASE}"
