<#
.SYNOPSIS
    Script de Restauração de Backup dos Volumes Docker (Windows / PowerShell)
.DESCRIPTION
    Restaura banco de dados PostgreSQL e os volumes Docker de mídias e sessões.
.PARAMETER BackupFolder
    Caminho da pasta do backup específico a restaurar (ex: .\backups\20261023_150000).
#>
param(
    [Parameter(Mandatory=$true)]
    [string]$BackupFolder
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BackupFolder)) {
    Write-Error "A pasta de backup especificada não existe: $BackupFolder"
    exit 1
}

$ResolvedPath = (Resolve-Path $BackupFolder).Path
Write-Host "==========================================================" -ForegroundColor Red
Write-Host "⚠️  ATENÇÃO: Restauração de Dados" -ForegroundColor Red
Write-Host "Origem: $ResolvedPath" -ForegroundColor Red
Write-Host "==========================================================" -ForegroundColor Red

$Confirmation = Read-Host "Tem certeza que deseja sobrescrever os dados atuais? Digite 'sim' para prosseguir"
if ($Confirmation -ne "sim") {
    Write-Host "Operação abortada pelo usuário." -ForegroundColor Yellow
    exit 0
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

$MountPath = $ResolvedPath.Replace("\", "/")

# 1. Restaurar Sessões
$SessionsArchive = Join-Path $ResolvedPath "backend_sessions.tar.gz"
if (Test-Path $SessionsArchive) {
    Write-Host "🔑 Restaurando volume backend_sessions..." -ForegroundColor Yellow
    docker run --rm -v ticket-whatsapp_backend_sessions:/target -v "${MountPath}:/backup" alpine sh -c "rm -rf /target/* && tar -xzf /backup/backend_sessions.tar.gz -C /target" 2>$null
    if ($LASTEXITCODE -ne 0) {
        docker run --rm -v backend_sessions:/target -v "${MountPath}:/backup" alpine sh -c "rm -rf /target/* && tar -xzf /backup/backend_sessions.tar.gz -C /target"
    }
    Write-Host "   ✅ Sessões restauradas." -ForegroundColor Green
}

# 2. Restaurar Mídias
$PublicArchive = Join-Path $ResolvedPath "backend_public.tar.gz"
if (Test-Path $PublicArchive) {
    Write-Host "📁 Restaurando volume backend_public..." -ForegroundColor Yellow
    docker run --rm -v ticket-whatsapp_backend_public:/target -v "${MountPath}:/backup" alpine sh -c "rm -rf /target/* && tar -xzf /backup/backend_public.tar.gz -C /target" 2>$null
    if ($LASTEXITCODE -ne 0) {
        docker run --rm -v backend_public:/target -v "${MountPath}:/backup" alpine sh -c "rm -rf /target/* && tar -xzf /backup/backend_public.tar.gz -C /target"
    }
    Write-Host "   ✅ Mídias restauradas." -ForegroundColor Green
}

# 3. Restaurar PostgreSQL
$SqlFiles = Get-ChildItem -Path $ResolvedPath -Filter "postgres_*.sql*"
if ($SqlFiles.Count -gt 0) {
    $SqlFile = $SqlFiles[0].FullName
    Write-Host "💾 Restaurando banco de dados a partir de $SqlFile..." -ForegroundColor Yellow
    if ($SqlFile.EndsWith(".gz")) {
        # Descompacta temporariamente se for .gz
        docker run --rm -v "${MountPath}:/backup" alpine gunzip -c "/backup/$($SqlFiles[0].Name)" | docker exec -i ticket-postgres psql -U $DbUser -d $DbName
    } else {
        Get-Content $SqlFile | docker exec -i ticket-postgres psql -U $DbUser -d $DbName
    }
    Write-Host "   ✅ Banco de dados restaurado com sucesso." -ForegroundColor Green
}

Write-Host "✨ Restauração concluída! Reinicie a stack com: docker compose restart" -ForegroundColor Green
