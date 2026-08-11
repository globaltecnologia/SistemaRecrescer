#!/usr/bin/env bash
# run-migration.sh — Executar migrations SQL pendentes no banco de produção
# Uso: ./deploy/run-migrations.sh <host> <port> <db> <user> <password> [ssl-ca-base64]

set -Eeuo pipefail

HOST="${1:?Uso: $0 <host> <port> <db> <user> <password> [ssl-ca-base64]}"
PORT="${2}"
DB="${3}"
USER="${4}"
PASS="${5}"
SSL_CA_B64="${6:-}"

MYSQL_OPTS="-h"$HOST" -P"$PORT" -u"$USER" -p"$PASS" --default-character-set=utf8mb4"
if [ -n "$SSL_CA_B64" ]; then
  CA_FILE=$(mktemp)
  echo "$SSL_CA_B64" | base64 -d > "$CA_FILE"
  MYSQL_OPTS="$MYSQL_OPTS --ssl-ca=$CA_FILE"
fi

MIGRATIONS_DIR="$(cd "$(dirname "$0")" && pwd)/migrations"
EXECUTED_FILE="$MIGRATIONS_DIR/.executed"

# Criar registro de migrações executadas
touch "$EXECUTED_FILE"

for migration_file in "$MIGRATIONS_DIR"/[0-9]*.sql; do
  [ -f "$migration_file" ] || continue
  migration_name=$(basename "$migration_file")

  # Verificar se já foi executada
  if grep -q "^${migration_name}$" "$EXECUTED_FILE" 2>/dev/null; then
    echo "[skip] $migration_name (já executada)"
    continue
  fi

  echo "[executing] $migration_name..."
  if mysql $MYSQL_OPTS "$DB" < "$migration_file"; then
    echo "$migration_name" >> "$EXECUTED_FILE"
    echo "[done] $migration_name"
  else
    echo "[FAIL] $migration_name — revertendo..."
    # Remover do registro se falhou
    sed -i "\|^${migration_name}$|d" "$EXECUTED_FILE"
    exit 1
  fi
done

echo "Todas as migrations aplicadas com sucesso."
