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
    $process = Start-Process -FilePath $Python -ArgumentList @("-m", "pixomerck.app") -WorkingDirectory $Root -RedirectStandardOutput $log -RedirectStandardError $errLog -PassThru -WindowStyle Hidden
    $process.Id | Set-Content -Path (Join-Path $Root "runtime\server.pid") -Encoding UTF8
    Write-Host "Pixomerck server started. PID $($process.Id)"
} else {
    & $Python -m pixomerck.app
}
