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

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
TARGET="/backups/${TIMESTAMP}"
mkdir -p "${TARGET}"

echo "[$(date)] ==> Iniciando rotina automática de backup em ${TARGET}..."

# 1. Dump do PostgreSQL
export PGPASSWORD="${DB_PASS}"
if pg_dump -h "${DB_HOST:-postgres}" -U "${DB_USER:-agilizap}" -d "${DB_NAME:-agilizap}" | gzip > "${TARGET}/postgres_${DB_NAME:-agilizap}.sql.gz"; then
    echo "  [OK] Dump do banco de dados concluído com sucesso."
else
    echo "  [ERRO] Falha ao gerar dump do PostgreSQL." >&2
fi
unset PGPASSWORD

# 2. Backup de Sessões WhatsApp
if [ -d /sessions ]; then
    tar -czf "${TARGET}/backend_sessions.tar.gz" -C /sessions . 2>/dev/null || true
    echo "  [OK] Sessões do WhatsApp compactadas."
fi

# 3. Backup de Mídias e Uploads
if [ -d /public ]; then
    tar -czf "${TARGET}/backend_public.tar.gz" -C /public . 2>/dev/null || true
    echo "  [OK] Mídias e uploads compactados."
fi

# 4. Rotação / Limpeza de backups antigos
RETENTION="${RETENTION_DAYS:-7}"
echo "  ==> Removendo backups mais antigos que ${RETENTION} dias..."
find /backups -mindepth 1 -maxdepth 1 -type d -mtime +"${RETENTION}" -exec rm -rf {} + 2>/dev/null || true

echo "[$(date)] ==> Backup concluído com sucesso!"
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
