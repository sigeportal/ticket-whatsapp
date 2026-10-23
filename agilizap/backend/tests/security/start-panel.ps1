$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '../../../..')).Path
$backendRoot = Join-Path $projectRoot 'agilizap/backend'
$frontendRoot = Join-Path $projectRoot 'agilizap/frontend'
$stateRoot = Join-Path $projectRoot '.security-work/panel'
$nodeExe = (Get-Command node -ErrorAction Stop).Source
$wslRoot = (& wsl -d Ubuntu -- wslpath -a $projectRoot.Replace('\','/')).Trim()
if ($LASTEXITCODE -ne 0) { throw 'WSL path unavailable' }
foreach ($port in @(18080,18081)) {
  if (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) { throw "Port $port already in use. Stop the existing panel first; do not stop unrelated processes." }
}
New-Item -ItemType Directory -Force -Path $stateRoot | Out-Null
Push-Location $frontendRoot
try {
  & $nodeExe node_modules/vite/bin/vite.js build --config vite.homologation.config.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Isolated frontend build failed' }
} finally { Pop-Location }
# Only this dedicated project's disposable tmpfs data is recreated.
& wsl -d Ubuntu -- docker compose -f "$wslRoot/agilizap/backend/tests/security/panel-compose.yml" down
if ($LASTEXITCODE -ne 0) { throw 'Could not remove previous disposable panel containers' }
& wsl -d Ubuntu -- docker compose -f "$wslRoot/agilizap/backend/tests/security/panel-compose.yml" up -d --wait
if ($LASTEXITCODE -ne 0) { throw 'Disposable panel services failed' }
$process = Start-Process -FilePath $nodeExe -ArgumentList 'tests/security/panel.cjs' -WorkingDirectory $backendRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $stateRoot 'stdout.log') -RedirectStandardError (Join-Path $stateRoot 'stderr.log')
$ready = $false
for ($attempt = 0; $attempt -lt 60; $attempt++) {
  if ($process.HasExited) { throw "Panel stopped. Inspect $stateRoot/stderr.log" }
  try {
    $status = Invoke-RestMethod -Uri 'http://127.0.0.1:18080/__homologacao/status' -TimeoutSec 1
    if ($status.isolated -eq $true) { $ready = $true; break }
  } catch { Start-Sleep -Seconds 1 }
}
if (-not $ready) { throw "Panel is not ready. Inspect $stateRoot/stderr.log" }
Write-Output 'Ready: http://homologacao.localhost:18081/__homologacao (fictitious data only)'
