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

# 1. Carregar variáveis de ambiente se existir arquivo .env
if [ -f .env ]; then
    # shellcheck disable=SC2046
    export $(grep -v '^#' .env | xargs -d '\n')
fi

DB_USER="${DB_USER:-agilizap}"
DB_NAME="${DB_NAME:-agilizap}"
COMPOSE_PROJECT="${COMPOSE_PROJECT_NAME:-ticket-whatsapp}"

# 2. Backup do Banco de Dados PostgreSQL
echo "💾 [1/3] Gerando dump do banco de dados PostgreSQL..."
if docker ps --format '{{.Names}}' | grep -q "ticket-postgres"; then
    docker exec ticket-postgres pg_dump -U "${DB_USER}" -d "${DB_NAME}" | gzip > "${TARGET_DIR}/postgres_${DB_NAME}.sql.gz"
    echo "   ✅ Banco de dados exportado com sucesso: postgres_${DB_NAME}.sql.gz"
else
    echo "   ⚠️ Container ticket-postgres não está rodando. Tentando via volume montado..."
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
