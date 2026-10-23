<#
.SYNOPSIS
    Script de Backup dos Volumes Docker e Banco de Dados (Windows / PowerShell)
.DESCRIPTION
    Executa dump do PostgreSQL e exporta arquivos de sessões e mídias dos Named Volumes.
.PARAMETER RetentionDays
    Quantidade de dias para reter backups antigos antes de excluir (padrão: 7).
#>
param(
    [int]$RetentionDays = 7
)

$ErrorActionPreference = "Stop"

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupDir = Join-Path $PSScriptRoot "..\backups"
$TargetDir = Join-Path $BackupDir $Timestamp

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "📦 Iniciando Backup do Ticket WhatsApp - $Timestamp" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

if (-not (Test-Path $TargetDir)) {
    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
}

$CurrentDir = (Get-Location).Path
$EnvFile = Join-Path $CurrentDir ".env"
$DbUser = "agilizap"
$DbName = "agilizap"

if (Test-Path $EnvFile) {
    Get-Content $EnvFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
            $parts = $line.Split("=", 2)
            $k = $parts[0].Trim()
            $v = $parts[1].Trim()
            if ($k -eq "DB_USER") { $DbUser = $v }
            if ($k -eq "DB_NAME") { $DbName = $v }
        }
    }
}

# 1. Backup do Banco de Dados PostgreSQL
Write-Host "💾 [1/3] Gerando dump do PostgreSQL..." -ForegroundColor Yellow
$DbOutputFile = Join-Path $TargetDir "postgres_${DbName}.sql"
try {
    docker exec ticket-postgres pg_dump -U $DbUser -d $DbName | Out-File -FilePath $DbOutputFile -Encoding utf8
    Write-Host "   ✅ Banco de dados exportado: postgres_${DbName}.sql" -ForegroundColor Green
} catch {
    Write-Host "   ⚠️ Não foi possível exportar via container ticket-postgres. Certifique-se de que ele está ativo." -ForegroundColor Red
}

# 2. Backup do Volume de Sessões (backend_sessions)
Write-Host "🔑 [2/3] Exportando sessões do WhatsApp (backend_sessions)..." -ForegroundColor Yellow
$TargetMount = $TargetDir.Replace("\", "/")
try {
    docker run --rm -v ticket-whatsapp_backend_sessions:/source:ro -v "${TargetMount}:/backup" alpine tar -czf "/backup/backend_sessions.tar.gz" -C /source . 2>$null
    if ($LASTEXITCODE -ne 0) {
        docker run --rm -v backend_sessions:/source:ro -v "${TargetMount}:/backup" alpine tar -czf "/backup/backend_sessions.tar.gz" -C /source .
    }
    Write-Host "   ✅ Sessões do WhatsApp exportadas: backend_sessions.tar.gz" -ForegroundColor Green
} catch {
    Write-Host "   ⚠️ Falha ao exportar sessões." -ForegroundColor Red
}

# 3. Backup do Volume de Mídias (backend_public)
Write-Host "📁 [3/3] Exportando mídias e uploads (backend_public)..." -ForegroundColor Yellow
try {
    docker run --rm -v ticket-whatsapp_backend_public:/source:ro -v "${TargetMount}:/backup" alpine tar -czf "/backup/backend_public.tar.gz" -C /source . 2>$null
    if ($LASTEXITCODE -ne 0) {
        docker run --rm -v backend_public:/source:ro -v "${TargetMount}:/backup" alpine tar -czf "/backup/backend_public.tar.gz" -C /source .
    }
    Write-Host "   ✅ Mídias exportadas: backend_public.tar.gz" -ForegroundColor Green
} catch {
    Write-Host "   ⚠️ Falha ao exportar mídias." -ForegroundColor Red
}

# 4. Limpeza de backups antigos
Write-Host ""
Write-Host "🧹 Verificando backups com mais de $RetentionDays dias..." -ForegroundColor Yellow
$CutoffDate = (Get-Date).AddDays(-$RetentionDays)
Get-ChildItem -Path $BackupDir -Directory | Where-Object { $_.CreationTime -lt $CutoffDate } | ForEach-Object {
    Write-Host "   Excluindo backup antigo: $($_.Name)" -ForegroundColor DarkGray
    Remove-Item -Path $_.FullName -Recurse -Force
}

Write-Host "✨ Backup finalizado com sucesso em $TargetDir" -ForegroundColor Green
