#!/usr/bin/env bash
set -Eeuo pipefail

SAM_INSTALL_DIR="${SAM_INSTALL_DIR:-${HOME}/.local/aws-sam-cli}"
SAM_BIN_DIR="${SAM_BIN_DIR:-${HOME}/.local/bin}"

command -v curl >/dev/null 2>&1 || { echo 'curl não encontrado' >&2; exit 1; }
command -v unzip >/dev/null 2>&1 || { echo 'unzip não encontrado' >&2; exit 1; }

if command -v sam >/dev/null 2>&1; then
  printf 'AWS SAM CLI já instalado: '
  sam --version
else
  case "$(uname -m)" in
    x86_64) sam_arch=x86_64 ;;
    aarch64|arm64) sam_arch=arm64 ;;
    *) echo "Arquitetura não suportada: $(uname -m)" >&2; exit 1 ;;
  esac

  tmp_dir="$(mktemp -d /tmp/aws-sam-cli.XXXXXX)"
  trap 'rm -rf "${tmp_dir}"' EXIT
  curl --fail --silent --show-error --location \
    "https://github.com/aws/aws-sam-cli/releases/latest/download/aws-sam-cli-linux-${sam_arch}.zip" \
    --output "${tmp_dir}/sam.zip"
  unzip -q "${tmp_dir}/sam.zip" -d "${tmp_dir}/installer"
  mkdir -p "${SAM_INSTALL_DIR}" "${SAM_BIN_DIR}"
  "${tmp_dir}/installer/install" \
    --install-dir "${SAM_INSTALL_DIR}" \
    --bin-dir "${SAM_BIN_DIR}"
  "${SAM_BIN_DIR}/sam" --version
fi

if command -v avn >/dev/null 2>&1; then
  printf 'Aiven CLI já instalado: '
  avn --version
else
  AIVEN_VENV="${AIVEN_VENV:-${HOME}/.local/aiven-cli}"
  python3 -m venv "${AIVEN_VENV}"
  "${AIVEN_VENV}/bin/pip" install --quiet --upgrade pip aiven-client
  ln -sfn "${AIVEN_VENV}/bin/avn" "${SAM_BIN_DIR}/avn"
  "${SAM_BIN_DIR}/avn" --version
fi
