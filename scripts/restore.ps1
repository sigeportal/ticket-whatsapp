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

function Invoke-DockerTarRestore {
    param(
        [string]$VolumePrimary,
        [string]$VolumeFallback,
        [string]$ArchiveName,
        [string]$MountPath
    )
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        & docker run --rm -v "${VolumePrimary}:/target" -v "${MountPath}:/backup" alpine sh -c "rm -rf /target/* && tar -xzf /backup/$ArchiveName -C /target" 2>$null
        $exitCode = $LASTEXITCODE
        if ($exitCode -ne 0) {
            & docker run --rm -v "${VolumeFallback}:/target" -v "${MountPath}:/backup" alpine sh -c "rm -rf /target/* && tar -xzf /backup/$ArchiveName -C /target"
            $exitCode = $LASTEXITCODE
        }
    } finally {
        $ErrorActionPreference = $prevEap
    }
    if ($exitCode -ne 0) {
        throw "Falha ao restaurar $ArchiveName (código $exitCode)."
    }
}

$MountPath = $ResolvedPath.Replace("\", "/")

# 1. Restaurar Sessões
$SessionsArchive = Join-Path $ResolvedPath "backend_sessions.tar.gz"
if (Test-Path $SessionsArchive) {
    Write-Host "🔑 Restaurando volume backend_sessions..." -ForegroundColor Yellow
    try {
        Invoke-DockerTarRestore -VolumePrimary "ticket-whatsapp_backend_sessions" -VolumeFallback "backend_sessions" -ArchiveName "backend_sessions.tar.gz" -MountPath $MountPath
        Write-Host "   ✅ Sessões restauradas." -ForegroundColor Green
    } catch {
        Write-Host "   ❌ Falha ao restaurar sessões: $_" -ForegroundColor Red
        exit 1
    }
}

# 2. Restaurar Mídias
$PublicArchive = Join-Path $ResolvedPath "backend_public.tar.gz"
if (Test-Path $PublicArchive) {
    Write-Host "📁 Restaurando volume backend_public..." -ForegroundColor Yellow
    try {
        Invoke-DockerTarRestore -VolumePrimary "ticket-whatsapp_backend_public" -VolumeFallback "backend_public" -ArchiveName "backend_public.tar.gz" -MountPath $MountPath
        Write-Host "   ✅ Mídias restauradas." -ForegroundColor Green
    } catch {
        Write-Host "   ❌ Falha ao restaurar mídias: $_" -ForegroundColor Red
        exit 1
    }
}

# 3. Restaurar PostgreSQL (execução direta no container sem transcodificação de pipe pelo PowerShell)
$SqlFiles = Get-ChildItem -Path $ResolvedPath -Filter "postgres_*.sql*" | Sort-Object { -not $_.Name.EndsWith(".gz") }, Name
if ($SqlFiles.Count -gt 0) {
    $SqlFile = $SqlFiles[0].FullName
    Write-Host "💾 Restaurando banco de dados a partir de $SqlFile..." -ForegroundColor Yellow

    $RunningPostgres = docker ps --format '{{.Names}}' | Where-Object { $_ -eq "ticket-postgres" }
    if (-not $RunningPostgres) {
        Write-Host "   ❌ Erro: container ticket-postgres não está em execução." -ForegroundColor Red
        exit 1
    }

    $RestoreId = [guid]::NewGuid().ToString("N")
    $ContainerInput = if ($SqlFile.EndsWith(".gz")) { "/tmp/pg_restore_$RestoreId.sql.gz" } else { "/tmp/pg_restore_$RestoreId.sql" }
    $ContainerSql = "/tmp/pg_restore_$RestoreId.sql"
    $DockerExecEnvArgs = @()
    if ($DbPass) {
        $DockerExecEnvArgs += @("-e", "PGPASSWORD=$DbPass")
    }

    try {
        & docker cp $SqlFile "ticket-postgres:$ContainerInput"
        if ($LASTEXITCODE -ne 0) {
            throw "Falha ao copiar arquivo SQL para o container (docker cp código $LASTEXITCODE)."
        }

        if ($SqlFile.EndsWith(".gz")) {
            & docker exec @DockerExecEnvArgs ticket-postgres sh -c 'set -e; gunzip -c "$1" > "$2"; psql -v ON_ERROR_STOP=1 -U "$3" -d "$4" -f "$2"' sh $ContainerInput $ContainerSql $DbUser $DbName
        } else {
            & docker exec @DockerExecEnvArgs ticket-postgres psql -v ON_ERROR_STOP=1 -U $DbUser -d $DbName -f $ContainerInput
        }
        if ($LASTEXITCODE -ne 0) {
            throw "psql retornou erro durante a restauração (código $LASTEXITCODE)."
        }

        Write-Host "   ✅ Banco de dados restaurado com sucesso." -ForegroundColor Green
    } catch {
        Write-Host "   ❌ Falha na restauração do banco de dados: $_" -ForegroundColor Red
        exit 1
    } finally {
        $prevEap = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        & docker exec ticket-postgres rm -f $ContainerInput $ContainerSql 2>$null | Out-Null
        $ErrorActionPreference = $prevEap
    }
}

Write-Host "✨ Restauração concluída! Reinicie a stack com: docker compose restart" -ForegroundColor Green
