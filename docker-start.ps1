<#
.SYNOPSIS
    Script utilitário para iniciar a stack Docker do Ticket WhatsApp no Windows.
#>

$ErrorActionPreference = "Stop"

Write-Host "🚀 Iniciando Ticket WhatsApp (Stack Docker)..." -ForegroundColor Cyan

# Cria .env a partir de .env.example se não existir
if (-not (Test-Path ".env")) {
    Write-Host "📋 Arquivo .env não encontrado. Copiando de .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
}

# Verifica se o docker está disponível no Windows diretamente ou no WSL
$hasDocker = Get-Command docker -ErrorAction SilentlyContinue

if ($hasDocker) {
    Write-Host "📦 Utilizando Docker Desktop / CLI nativo..." -ForegroundColor Green
    docker compose up -d --build
    docker compose ps
} else {
    Write-Host "📦 Docker CLI nativo não detectado. Delegando execução para WSL (Ubuntu)..." -ForegroundColor Magenta
    wsl docker compose up -d --build
    wsl docker compose ps
}

Write-Host "`n✅ Stack iniciada com sucesso!" -ForegroundColor Green
Write-Host "👉 Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "👉 Backend:  http://localhost:8080" -ForegroundColor Cyan
Write-Host "`nPara visualizar logs: docker compose logs -f (ou wsl docker compose logs -f)" -ForegroundColor Gray
