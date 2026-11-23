#!/usr/bin/env bash
# ==============================================================================
# Script de Backup dos Volumes e Banco de Dados (Ticket WhatsApp)
# ==============================================================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
TARGET_DIR="${BACKUP_DIR}/${TIMESTAMP}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

echo "=========================================================="
echo "📦 Iniciando Backup do Ticket WhatsApp - ${TIMESTAMP}"
echo "=========================================================="

mkdir -p "${TARGET_DIR}"

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
COMPOSE_PROJECT="${COMPOSE_PROJECT_NAME:-ticket-whatsapp}"

# 2. Backup do Banco de Dados PostgreSQL
echo "💾 [1/3] Gerando dump do banco de dados PostgreSQL..."
if docker ps --format '{{.Names}}' | grep -qx "ticket-postgres"; then
    if [ -n "${DB_PASS:-}" ]; then
        docker exec -e "PGPASSWORD=${DB_PASS}" ticket-postgres \
            pg_dump --clean --if-exists -U "${DB_USER}" -d "${DB_NAME}" \
            | gzip > "${TARGET_DIR}/postgres_${DB_NAME}.sql.gz"
    else
        docker exec ticket-postgres \
            pg_dump --clean --if-exists -U "${DB_USER}" -d "${DB_NAME}" \
            | gzip > "${TARGET_DIR}/postgres_${DB_NAME}.sql.gz"
    fi
    test -s "${TARGET_DIR}/postgres_${DB_NAME}.sql.gz"
    gzip -t "${TARGET_DIR}/postgres_${DB_NAME}.sql.gz"
    echo "   ✅ Banco de dados exportado com sucesso: postgres_${DB_NAME}.sql.gz"
else
    echo "   ❌ Erro: container ticket-postgres não está rodando." >&2
    exit 1
fi

# 3. Backup do Volume de Sessões do WhatsApp (backend_sessions)
echo "🔑 [2/3] Copiando sessões ativas do WhatsApp (backend_sessions)..."
docker run --rm \
    -v ticket-whatsapp_backend_sessions:/source:ro \
    -v "$(pwd)/${TARGET_DIR}":/backup \
    alpine tar -czf "/backup/backend_sessions.tar.gz" -C /source . 2>/dev/null || \
docker run --rm \
    -v backend_sessions:/source:ro \
    -v "$(pwd)/${TARGET_DIR}":/backup \
    alpine tar -czf "/backup/backend_sessions.tar.gz" -C /source .

echo "   ✅ Sessões do WhatsApp exportadas: backend_sessions.tar.gz"

# 4. Backup do Volume de Mídias/Uploads (backend_public)
echo "📁 [3/3] Copiando mídias e arquivos (backend_public)..."
docker run --rm \
    -v ticket-whatsapp_backend_public:/source:ro \
    -v "$(pwd)/${TARGET_DIR}":/backup \
    alpine tar -czf "/backup/backend_public.tar.gz" -C /source . 2>/dev/null || \
docker run --rm \
    -v backend_public:/source:ro \
    -v "$(pwd)/${TARGET_DIR}":/backup \
    alpine tar -czf "/backup/backend_public.tar.gz" -C /source .

echo "   ✅ Mídias exportadas: backend_public.tar.gz"

# 5. Resumo do tamanho dos arquivos
echo ""
echo "📊 Conteúdo do Backup gerado em ${TARGET_DIR}:"
ls -lh "${TARGET_DIR}"

# 6. Limpeza de backups antigos (política de retenção)
echo ""
echo "🧹 Removendo backups com mais de ${RETENTION_DAYS} dias em ${BACKUP_DIR}..."
find "${BACKUP_DIR}" -mindepth 1 -maxdepth 1 -type d -mtime +"${RETENTION_DAYS}" -exec rm -rf {} + 2>/dev/null || true

echo "✨ Backup finalizado com sucesso em ${TARGET_DIR}!"
