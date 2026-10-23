#!/bin/sh
set -e

echo "==> [Entrypoint] Verificando e executando migrações pendentes do banco de dados..."
if ! npx sequelize db:migrate; then
  echo "==> [ERRO CRÍTICO] Falha ao executar migrações do banco de dados. Abortando inicialização para proteger a integridade dos dados." >&2
  exit 1
fi

echo "==> [Entrypoint] Migrações verificadas com sucesso. Seeds automáticos desabilitados no restart para proteção de dados."
echo "==> [Entrypoint] Iniciando servidor da aplicação..."

exec "$@"
