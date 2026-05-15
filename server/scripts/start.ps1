param(
    [switch]$Detached,
    [switch]$StartComfyUI,
    [string]$ComfyUiDir = (Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..")).Path "vendor\ComfyUI")
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$EnvFile = Join-Path $Root "runtime\pixomerck.env.ps1"
$Python = Join-Path $Root ".venv\Scripts\python.exe"

function Repair-ProcessPathEnvironment {
    $pathValue = [Environment]::GetEnvironmentVariable("Path", "Process")
    if (-not $pathValue) {
        $pathValue = [Environment]::GetEnvironmentVariable("PATH", "Process")
    }
    if (-not $pathValue) {
        return
    }

    [Environment]::SetEnvironmentVariable("PATH", $null, "Process")
    [Environment]::SetEnvironmentVariable("Path", $null, "Process")
    [Environment]::SetEnvironmentVariable("Path", $pathValue, "Process")
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

Repair-ProcessPathEnvironment

if (Test-Path $EnvFile) {
    . $EnvFile
}

$env:PYTHONPATH = Join-Path $Root "src"

if ($StartComfyUI) {
    $ComfyPython = Join-Path $ComfyUiDir ".venv\Scripts\python.exe"
    if (-not (Test-Path $ComfyPython)) {
        throw "ComfyUI venv not found. Run scripts\install.ps1 -DownloadComfyUI first."
    }
    $comfyPidPath = Join-Path $Root "runtime\comfyui.pid"
    $existingComfyPid = if (Test-Path $comfyPidPath) { Get-Content $comfyPidPath -ErrorAction SilentlyContinue } else { $null }
    $existingComfyProcess = if ($existingComfyPid) { Get-Process -Id $existingComfyPid -ErrorAction SilentlyContinue } else { $null }

    if ($existingComfyProcess) {
        Write-Host "ComfyUI already running. PID $($existingComfyProcess.Id)"
    } else {
        $comfyLog = Join-Path $Root "runtime\comfyui.log"
        $comfyErrLog = Join-Path $Root "runtime\comfyui.err.log"
        $comfyProcess = Start-Process -FilePath $ComfyPython -ArgumentList @("main.py", "--listen", "127.0.0.1", "--port", "8188", "--lowvram") -WorkingDirectory $ComfyUiDir -RedirectStandardOutput $comfyLog -RedirectStandardError $comfyErrLog -PassThru -WindowStyle Hidden
        $comfyProcess.Id | Set-Content -Path $comfyPidPath -Encoding UTF8
        Write-Host "ComfyUI started. PID $($comfyProcess.Id)"
    }
}

if (-not (Test-Path $Python)) {
    throw "Pixomerck venv not found. Run scripts\install.ps1 first."
}

if ($Detached) {
    $log = Join-Path $Root "runtime\server.log"
    $errLog = Join-Path $Root "runtime\server.err.log"
    $pidPath = Join-Path $Root "runtime\server.pid"
    $process = Start-Process -FilePath $Python -ArgumentList @("-m", "pixomerck.app") -WorkingDirectory $Root -RedirectStandardOutput $log -RedirectStandardError $errLog -PassThru -WindowStyle Hidden
    $serverPort = if ($env:PIXOMERCK_PORT) { [int]$env:PIXOMERCK_PORT } else { 8765 }
    $serverPid = $process.Id
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        Start-Sleep -Milliseconds 500
        $listenerPid = Get-ListeningProcessId -Port $serverPort
        if ($listenerPid) {
            $serverPid = $listenerPid
            break
        }
    }
    $serverPid | Set-Content -Path $pidPath -Encoding UTF8
    Write-Host "Pixomerck server started. PID $serverPid"
} else {
    & $Python -m pixomerck.app
}
