#!/usr/bin/env bash
set -e

echo "🚀 Iniciando Ticket WhatsApp (Stack Docker)..."

# Copia .env.example se .env não existir
if [ ! -f .env ]; then
    echo "📋 Arquivo .env não encontrado. Copiando de .env.example..."
    cp .env.example .env
fi

echo "📦 Construindo e iniciando containers em segundo plano..."
docker compose up -d --build

echo "⏳ Aguardando serviços ficarem operacionais..."
docker compose ps

echo ""
echo "✅ Stack iniciada com sucesso!"
echo "👉 Frontend: http://localhost:3000"
echo "👉 Backend:  http://localhost:8080"
echo ""
echo "Para visualizar logs em tempo real: docker compose logs -f"
