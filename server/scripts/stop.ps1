$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$PidFile = Join-Path $Root "runtime\server.pid"

if (-not (Test-Path $PidFile)) {
    Write-Host "No Pixomerck server PID file found."
    exit 0
}

$ServerPid = [int](Get-Content $PidFile)
$process = Get-Process -Id $ServerPid -ErrorAction SilentlyContinue
if ($process) {
    Stop-Process -Id $ServerPid -Force
    Write-Host "Stopped Pixomerck server PID $ServerPid."
} else {
    Write-Host "Pixomerck server PID $ServerPid is not running."
}

Remove-Item -LiteralPath $PidFile -Force
