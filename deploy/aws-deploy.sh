#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

usage() {
  cat <<'EOF'
Uso: ./deploy/aws-deploy.sh <comando>

Comandos:
  install-tools  Instala/atualiza o AWS SAM CLI no usuário atual
  provision-db   Provisiona o MySQL gratuito na Aiven e gera config.env
  preflight      Valida ferramentas, identidade AWS e configuração
  build          Valida o template e constrói a imagem Lambda
  deploy         Constrói e implanta a stack AWS SAM
  verify         Testa a Function URL publicada
  frontend-build Constrói o frontend apontando para a API publicada
  frontend-deploy Publica o frontend no Cloudflare Pages
  frontend-verify Valida o site publicado
  frontend-all   Executa build, deploy e verify do frontend
  all            Executa preflight, build, deploy e verify
EOF
}

case "${1:-}" in
  install-tools) exec "${SCRIPT_DIR}/install-tools.sh" ;;
  provision-db)  exec "${SCRIPT_DIR}/provision-mysql-aiven.sh" ;;
  preflight)     exec "${SCRIPT_DIR}/preflight.sh" ;;
  build)         exec "${SCRIPT_DIR}/build.sh" ;;
  deploy)        exec "${SCRIPT_DIR}/deploy.sh" ;;
  verify)        exec "${SCRIPT_DIR}/verify.sh" ;;
  frontend-build) exec "${SCRIPT_DIR}/frontend-build.sh" ;;
  frontend-deploy) exec "${SCRIPT_DIR}/frontend-deploy-cloudflare.sh" ;;
  frontend-verify) exec "${SCRIPT_DIR}/frontend-verify.sh" ;;
  frontend-all)
    "${SCRIPT_DIR}/frontend-build.sh"
    "${SCRIPT_DIR}/frontend-deploy-cloudflare.sh" --skip-build
    exec "${SCRIPT_DIR}/frontend-verify.sh"
    ;;
  all)
    "${SCRIPT_DIR}/preflight.sh"
    "${SCRIPT_DIR}/build.sh"
    "${SCRIPT_DIR}/deploy.sh" --skip-build
    exec "${SCRIPT_DIR}/verify.sh"
    ;;
  -h|--help|help|"") usage ;;
  *) printf 'Comando desconhecido: %s\n' "$1" >&2; usage >&2; exit 2 ;;
esac
