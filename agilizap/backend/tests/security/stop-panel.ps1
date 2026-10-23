$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '../../../..')).Path
$statePath = Join-Path $projectRoot '.security-work/panel/state.json'
if (Test-Path -LiteralPath $statePath) {
  $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $([int]$state.pid)"
  if ($process) {
    if ($process.Name -ne 'node.exe' -or $process.CommandLine -notmatch 'tests[/\\]security[/\\]panel\.cjs') { throw 'PID belongs to a different process; refusing to stop it' }
    Stop-Process -Id ([int]$state.pid) -Force
  }
  $tempPath = [IO.Path]::GetFullPath([string]$state.temp)
  $tempParent = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\')
  if ([IO.Path]::GetDirectoryName($tempPath) -ne $tempParent -or [IO.Path]::GetFileName($tempPath) -notlike 'ticket-panel-*') { throw 'Refusing cleanup outside the exclusive test temp directory' }
  if (Test-Path -LiteralPath $tempPath) { Remove-Item -LiteralPath $tempPath -Recurse -Force }
  Remove-Item -LiteralPath $statePath
}
$wslRoot = (& wsl -d Ubuntu -- wslpath -a $projectRoot.Replace('\','/')).Trim()
if ($LASTEXITCODE -ne 0) { throw 'WSL path unavailable' }
& wsl -d Ubuntu -- docker compose -f "$wslRoot/agilizap/backend/tests/security/panel-compose.yml" down
if ($LASTEXITCODE -ne 0) { throw 'Could not remove disposable panel containers' }
Write-Output 'Disposable panel stopped; fictitious DB/Redis/media discarded.'
