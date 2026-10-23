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

# 1. Carregar variáveis de ambiente
if [ -f .env ]; then
    # shellcheck disable=SC2046
    export $(grep -v '^#' .env | xargs -d '\n')
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
SQL_FILE=$(ls "${BACKUP_SOURCE}"/postgres_*.sql.gz 2>/dev/null | head -n 1 || true)
if [ -n "${SQL_FILE}" ]; then
    echo "💾 Restaurando banco de dados PostgreSQL a partir de ${SQL_FILE}..."
    gunzip -c "${SQL_FILE}" | docker exec -i ticket-postgres psql -U "${DB_USER}" -d "${DB_NAME}"
    echo "   ✅ Banco de dados restaurado com sucesso."
fi

echo "✨ Restauração finalizada! Reinicie a stack com: docker compose restart"
