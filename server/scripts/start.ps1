param(
    [switch]$Detached,
    [switch]$StartComfyUI,
    [string]$ComfyUiDir = (Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..")).Path "vendor\ComfyUI")
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$EnvFile = Join-Path $Root "runtime\pixomerck.env.ps1"
$Python = Join-Path $Root ".venv\Scripts\python.exe"

if (Test-Path $EnvFile) {
    . $EnvFile
}

$env:PYTHONPATH = Join-Path $Root "src"

if ($StartComfyUI) {
    $ComfyPython = Join-Path $ComfyUiDir ".venv\Scripts\python.exe"
    if (-not (Test-Path $ComfyPython)) {
        throw "ComfyUI venv not found. Run scripts\install.ps1 -DownloadComfyUI first."
    }
    Start-Process -FilePath $ComfyPython -ArgumentList @("main.py", "--listen", "127.0.0.1", "--port", "8188", "--lowvram") -WorkingDirectory $ComfyUiDir -WindowStyle Hidden
}

if (-not (Test-Path $Python)) {
    throw "Pixomerck venv not found. Run scripts\install.ps1 first."
}

if ($Detached) {
    $log = Join-Path $Root "runtime\server.log"
    $process = Start-Process -FilePath $Python -ArgumentList @("-m", "pixomerck.app") -WorkingDirectory $Root -RedirectStandardOutput $log -RedirectStandardError $log -PassThru -WindowStyle Hidden
    $process.Id | Set-Content -Path (Join-Path $Root "runtime\server.pid") -Encoding UTF8
    Write-Host "Pixomerck server started. PID $($process.Id)"
} else {
    & $Python -m pixomerck.app
}
