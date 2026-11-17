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
if (-not (Test-Path $EnvFile)) {
    $RepoEnvFile = Join-Path (Join-Path $PSScriptRoot "..") ".env"
    if (Test-Path $RepoEnvFile) { $EnvFile = $RepoEnvFile }
}
$DbUser = "agilizap"
$DbName = "agilizap"
$DbPass = ""

if (Test-Path $EnvFile) {
    Get-Content $EnvFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
            $parts = $line.Split("=", 2)
            $k = $parts[0].Trim()
            $v = $parts[1].Trim()
            if (($v.StartsWith('"') -and $v.EndsWith('"')) -or ($v.StartsWith("'") -and $v.EndsWith("'"))) {
                if ($v.Length -ge 2) { $v = $v.Substring(1, $v.Length - 2) }
            }
            if ($k -eq "DB_USER") { $DbUser = $v }
            if ($k -eq "DB_NAME") { $DbName = $v }
            if ($k -eq "DB_PASS") { $DbPass = $v }
        }
    }
}

function Invoke-DockerTarBackup {
    param(
        [string]$VolumePrimary,
        [string]$VolumeFallback,
        [string]$ArchiveName,
        [string]$TargetMount
    )
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        & docker run --rm -v "${VolumePrimary}:/source:ro" -v "${TargetMount}:/backup" alpine tar -czf "/backup/$ArchiveName" -C /source . 2>$null
        $exitCode = $LASTEXITCODE
        if ($exitCode -ne 0) {
            & docker run --rm -v "${VolumeFallback}:/source:ro" -v "${TargetMount}:/backup" alpine tar -czf "/backup/$ArchiveName" -C /source .
            $exitCode = $LASTEXITCODE
        }
    } finally {
        $ErrorActionPreference = $prevEap
    }
    if ($exitCode -ne 0) {
        throw "Falha ao exportar volume para $ArchiveName (código $exitCode)."
    }
}

# 1. Backup do Banco de Dados PostgreSQL (gerado e compactado dentro do container para preservar UTF-8 sem BOM)
Write-Host "💾 [1/3] Gerando dump do PostgreSQL..." -ForegroundColor Yellow
$DbOutputFile = Join-Path $TargetDir "postgres_${DbName}.sql.gz"
$ContainerTmpBase = "/tmp/pg_backup_$Timestamp"
$ContainerSqlFile = "$ContainerTmpBase.sql"
$ContainerGzFile = "$ContainerTmpBase.sql.gz"
$DockerExecEnvArgs = @()
if ($DbPass) {
    $DockerExecEnvArgs += @("-e", "PGPASSWORD=$DbPass")
}

try {
    $RunningPostgres = docker ps --format '{{.Names}}' | Where-Object { $_ -eq "ticket-postgres" }
    if (-not $RunningPostgres) {
        throw "Container ticket-postgres não está em execução."
    }

    & docker exec @DockerExecEnvArgs ticket-postgres sh -c 'set -e; rm -f "$1" "$2"; pg_dump --clean --if-exists -U "$3" -d "$4" -f "$1"; gzip -f "$1"; gzip -t "$2"' sh $ContainerSqlFile $ContainerGzFile $DbUser $DbName
    if ($LASTEXITCODE -ne 0) {
        throw "pg_dump/gzip dentro do container falhou com código $LASTEXITCODE."
    }

    & docker cp "ticket-postgres:$ContainerGzFile" $DbOutputFile
    if ($LASTEXITCODE -ne 0) {
        throw "Falha ao copiar dump compactado do container (docker cp código $LASTEXITCODE)."
    }

    if (-not (Test-Path $DbOutputFile) -or (Get-Item $DbOutputFile).Length -eq 0) {
        throw "Arquivo de dump gerado está ausente ou vazio: $DbOutputFile"
    }

    Write-Host "   ✅ Banco de dados exportado: postgres_${DbName}.sql.gz" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Não foi possível exportar via container ticket-postgres: $_" -ForegroundColor Red
    exit 1
} finally {
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & docker exec ticket-postgres rm -f $ContainerSqlFile $ContainerGzFile 2>$null | Out-Null
    $ErrorActionPreference = $prevEap
}

# 2. Backup do Volume de Sessões (backend_sessions)
Write-Host "🔑 [2/3] Exportando sessões do WhatsApp (backend_sessions)..." -ForegroundColor Yellow
$TargetMount = $TargetDir.Replace("\", "/")
try {
    Invoke-DockerTarBackup -VolumePrimary "ticket-whatsapp_backend_sessions" -VolumeFallback "backend_sessions" -ArchiveName "backend_sessions.tar.gz" -TargetMount $TargetMount
    Write-Host "   ✅ Sessões do WhatsApp exportadas: backend_sessions.tar.gz" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Falha ao exportar sessões: $_" -ForegroundColor Red
    exit 1
}

# 3. Backup do Volume de Mídias (backend_public)
Write-Host "📁 [3/3] Exportando mídias e uploads (backend_public)..." -ForegroundColor Yellow
try {
    Invoke-DockerTarBackup -VolumePrimary "ticket-whatsapp_backend_public" -VolumeFallback "backend_public" -ArchiveName "backend_public.tar.gz" -TargetMount $TargetMount
    Write-Host "   ✅ Mídias exportadas: backend_public.tar.gz" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Falha ao exportar mídias: $_" -ForegroundColor Red
    exit 1
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
