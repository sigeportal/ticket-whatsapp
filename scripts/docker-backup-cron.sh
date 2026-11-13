#!/bin/sh
set -e

echo "==> [Backup Service] Instalando cliente PostgreSQL e dependências..."
apk add --no-cache postgresql-client tzdata tar gzip > /dev/null

echo "==> [Backup Service] Configurando timezone para ${TZ:-America/Campo_Grande}..."
cp /usr/share/zoneinfo/${TZ:-America/Campo_Grande} /etc/localtime 2>/dev/null || true
echo "${TZ:-America/Campo_Grande}" > /etc/timezone 2>/dev/null || true

BACKUP_SCRIPT="/usr/local/bin/run-backup.sh"

cat << 'EOF' > "${BACKUP_SCRIPT}"
#!/bin/sh
set -e

BACKUP_ROOT="${BACKUP_ROOT:-/backups}"
SESSIONS_DIR="${SESSIONS_DIR:-/sessions}"
PUBLIC_DIR="${PUBLIC_DIR:-/public}"
DB_HOST_VAL="${DB_HOST:-postgres}"
DB_USER_VAL="${DB_USER:-agilizap}"
DB_NAME_VAL="${DB_NAME:-agilizap}"
RETENTION="${RETENTION_DAYS:-7}"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FINAL_DIR="${BACKUP_ROOT}/${TIMESTAMP}"
STAGING_DIR=""

cleanup_on_exit() {
    status=$?
    unset PGPASSWORD
    if [ "${status}" -ne 0 ]; then
        if [ -n "${STAGING_DIR}" ]; then
            echo "[$(date)] ==> [ERRO] Falha na rotina de backup (codigo ${status}). Pasta incompleta mantida em ${STAGING_DIR}" >&2
        else
            echo "[$(date)] ==> [ERRO] Falha na rotina de backup (codigo ${status})." >&2
        fi
    fi
    exit "${status}"
}
trap cleanup_on_exit EXIT

# 1. Criar pasta temporária marcada como incompleta
mkdir -p "${BACKUP_ROOT}"
STAGING_DIR=$(mktemp -d "${BACKUP_ROOT}/${TIMESTAMP}.incomplete.XXXXXX")

echo "[$(date)] ==> Iniciando rotina automática de backup em ${STAGING_DIR}..."

# 2. Validar volumes obrigatórios, exportar o banco e compactar sessões e mídias
test -d "${SESSIONS_DIR}"
test -d "${PUBLIC_DIR}"

SQL_FILE="${STAGING_DIR}/postgres_${DB_NAME_VAL}.sql"
SQL_GZ_FILE="${SQL_FILE}.gz"
SESSIONS_ARCHIVE="${STAGING_DIR}/backend_sessions.tar.gz"
PUBLIC_ARCHIVE="${STAGING_DIR}/backend_public.tar.gz"

export PGPASSWORD="${DB_PASS:-}"
pg_dump \
    -h "${DB_HOST_VAL}" \
    -U "${DB_USER_VAL}" \
    -d "${DB_NAME_VAL}" \
    > "${SQL_FILE}"
unset PGPASSWORD

test -s "${SQL_FILE}"
gzip "${SQL_FILE}"

tar -czf "${SESSIONS_ARCHIVE}" -C "${SESSIONS_DIR}" .
tar -czf "${PUBLIC_ARCHIVE}" -C "${PUBLIC_DIR}" .

# 3. Validar os três arquivos gerados antes de publicar
test -s "${SQL_GZ_FILE}"
gzip -t "${SQL_GZ_FILE}"

test -s "${SESSIONS_ARCHIVE}"
tar -tzf "${SESSIONS_ARCHIVE}" > /dev/null

test -s "${PUBLIC_ARCHIVE}"
tar -tzf "${PUBLIC_ARCHIVE}" > /dev/null

# 4. Publicar a pasta como backup concluído
if [ -e "${FINAL_DIR}" ]; then
    echo "  [ERRO] Diretório de backup já existe: ${FINAL_DIR}" >&2
    exit 1
fi
mv "${STAGING_DIR}" "${FINAL_DIR}"
STAGING_DIR=""

# 5. Executar retenção somente após confirmar o novo backup
echo "  ==> Removendo backups mais antigos que ${RETENTION} dias..."
find "${BACKUP_ROOT}" -mindepth 1 -maxdepth 1 -type d -mtime +"${RETENTION}" -exec rm -rf {} +

# 6. Registrar sucesso apenas ao final
echo "[$(date)] ==> Backup concluído com sucesso em ${FINAL_DIR}!"
EOF

chmod +x "${BACKUP_SCRIPT}"

# Executa um backup inicial para garantir integridade
echo "==> [Backup Service] Executando validação de backup inicial na inicialização..."
"${BACKUP_SCRIPT}"

# Registra a cron job (padrão: 03:00 diariamente)
CRON_SCHEDULE="${BACKUP_CRON:-0 3 * * *}"
echo "${CRON_SCHEDULE} ${BACKUP_SCRIPT} >> /var/log/backup.log 2>&1" | crontab -

echo "==> [Backup Service] Agendamento configurado: '${CRON_SCHEDULE}'"
echo "==> [Backup Service] Iniciando daemon do Cron em segundo plano..."

exec crond -f -l 2
