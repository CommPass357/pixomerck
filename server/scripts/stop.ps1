$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$PidFile = Join-Path $Root "runtime\server.pid"
$EnvFile = Join-Path $Root "runtime\pixomerck.env.ps1"

if (Test-Path $EnvFile) {
    . $EnvFile
}

function Get-ListeningProcessId {
    param([int]$Port)

    $pattern = "^\s*TCP\s+\S+:$Port\s+\S+\s+LISTENING\s+(\d+)\s*$"
    $line = netstat -ano | Select-String -Pattern $pattern | Select-Object -First 1
    if (-not $line) {
        return $null
    }
    return [int]$line.Matches[0].Groups[1].Value
}

$serverPort = if ($env:PIXOMERCK_PORT) { [int]$env:PIXOMERCK_PORT } else { 8765 }
$candidatePids = @()
if (Test-Path $PidFile) {
    $candidatePids += [int](Get-Content $PidFile)
}
$listenerPid = Get-ListeningProcessId -Port $serverPort
if ($listenerPid) {
    $candidatePids += $listenerPid
}

$candidatePids = $candidatePids | Select-Object -Unique
if (-not $candidatePids) {
    Write-Host "No Pixomerck server process found."
} else {
    foreach ($serverPid in $candidatePids) {
        $process = Get-Process -Id $serverPid -ErrorAction SilentlyContinue
        if ($process) {
            Stop-Process -Id $serverPid -Force
            Write-Host "Stopped Pixomerck server PID $serverPid."
        } else {
            Write-Host "Pixomerck server PID $serverPid is not running."
        }
    }
}

if (Test-Path $PidFile) {
    Remove-Item -LiteralPath $PidFile -Force
}
