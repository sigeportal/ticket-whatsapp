#!/usr/bin/env bash
set -euo pipefail

# Executa a pré-configuração padrão (filas, horários MS, mensagens manuais,
# respostas rápidas, informativos e campanhas de teste inativas) dentro do container backend.
COMPANY_ARG=""
if [ "${1:-}" != "" ]; then
  COMPANY_ARG="-- --companyId=$1"
fi

docker exec ticket-backend npm run setup:defaults ${COMPANY_ARG}
