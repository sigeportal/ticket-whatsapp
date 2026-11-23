#!/usr/bin/env bash
# ==============================================================================
# Script de Restauração de Backup dos Volumes (Ticket WhatsApp)
# Uso: ./scripts/restore.sh backups/YYYYMMDD_HHMMSS
# ==============================================================================
set -euo pipefail

if [ -z "${1:-}" ]; then
    echo "❌ Erro: informe o caminho da pasta de backup a restaurar."
    echo "Exemplo: ./scripts/restore.sh backups/20261023_150000"
    exit 1
fi

BACKUP_SOURCE="$1"

if [ ! -d "${BACKUP_SOURCE}" ]; then
    echo "❌ Erro: o diretório '${BACKUP_SOURCE}' não existe!"
    exit 1
fi

echo "=========================================================="
echo "⚠️  ATENÇÃO: Restauração de Dados"
echo "Origem: ${BACKUP_SOURCE}"
echo "=========================================================="
read -p "Tem certeza que deseja sobrescrever os dados atuais? (digite 'sim' para continuar): " CONFIRM
if [ "${CONFIRM}" != "sim" ]; then
    echo "Operação cancelada pelo usuário."
    exit 0
fi

# 1. Carregar apenas variáveis DB_* do .env com globbing desabilitado (set -f)
load_db_env() {
    local env_file="$1"
    [ -f "$env_file" ] || return 0
    set -f
    while IFS= read -r line || [ -n "$line" ]; do
        line="${line%$'\r'}"
        line="${line#"${line%%[![:space:]]*}"}"
        case "$line" in
            ""|\#*) continue ;;
            DB_*=*)
                local key="${line%%=*}"
                local val="${line#*=}"
                case "$val" in
                    \"*\") val="${val#\"}"; val="${val%\"}" ;;
                    \'*\') val="${val#\'}"; val="${val%\'}" ;;
                esac
                export "${key}=${val}"
                ;;
        esac
    done < "$env_file"
    set +f
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f .env ]; then
    load_db_env .env
elif [ -f "${SCRIPT_DIR}/../.env" ]; then
    load_db_env "${SCRIPT_DIR}/../.env"
fi

DB_USER="${DB_USER:-agilizap}"
DB_NAME="${DB_NAME:-agilizap}"

# 2. Restaurar Sessões do WhatsApp
if [ -f "${BACKUP_SOURCE}/backend_sessions.tar.gz" ]; then
    echo "🔑 Restaurando volume backend_sessions..."
    docker run --rm \
        -v ticket-whatsapp_backend_sessions:/target \
        -v "$(realpath "${BACKUP_SOURCE}")":/backup \
        alpine sh -c "rm -rf /target/* && tar -xzf /backup/backend_sessions.tar.gz -C /target" 2>/dev/null || \
    docker run --rm \
        -v backend_sessions:/target \
        -v "$(realpath "${BACKUP_SOURCE}")":/backup \
        alpine sh -c "rm -rf /target/* && tar -xzf /backup/backend_sessions.tar.gz -C /target"
    echo "   ✅ Sessões restauradas."
fi

# 3. Restaurar Mídias e Arquivos
if [ -f "${BACKUP_SOURCE}/backend_public.tar.gz" ]; then
    echo "📁 Restaurando volume backend_public..."
    docker run --rm \
        -v ticket-whatsapp_backend_public:/target \
        -v "$(realpath "${BACKUP_SOURCE}")":/backup \
        alpine sh -c "rm -rf /target/* && tar -xzf /backup/backend_public.tar.gz -C /target" 2>/dev/null || \
    docker run --rm \
        -v backend_public:/target \
        -v "$(realpath "${BACKUP_SOURCE}")":/backup \
        alpine sh -c "rm -rf /target/* && tar -xzf /backup/backend_public.tar.gz -C /target"
    echo "   ✅ Mídias restauradas."
fi

# 4. Restaurar Banco de Dados PostgreSQL
run_psql_restore() {
    if [ -n "${DB_PASS:-}" ]; then
        docker exec -i -e "PGPASSWORD=${DB_PASS}" ticket-postgres psql -v ON_ERROR_STOP=1 -U "${DB_USER}" -d "${DB_NAME}"
    else
        docker exec -i ticket-postgres psql -v ON_ERROR_STOP=1 -U "${DB_USER}" -d "${DB_NAME}"
    fi
}

SQL_FILE=$(ls "${BACKUP_SOURCE}"/postgres_*.sql.gz 2>/dev/null | head -n 1 || true)
if [ -z "${SQL_FILE}" ]; then
    SQL_FILE=$(ls "${BACKUP_SOURCE}"/postgres_*.sql 2>/dev/null | head -n 1 || true)
fi

if [ -n "${SQL_FILE}" ]; then
    echo "💾 Restaurando banco de dados PostgreSQL a partir de ${SQL_FILE}..."
    if ! docker ps --format '{{.Names}}' | grep -qx "ticket-postgres"; then
        echo "   ❌ Erro: container ticket-postgres não está rodando." >&2
        exit 1
    fi
    case "${SQL_FILE}" in
        *.gz) gunzip -c "${SQL_FILE}" | run_psql_restore ;;
        *)    run_psql_restore < "${SQL_FILE}" ;;
    esac
    echo "   ✅ Banco de dados restaurado com sucesso."
fi

echo "✨ Restauração finalizada! Reinicie a stack com: docker compose restart"
