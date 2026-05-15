param(
    [string]$InstallDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
    [string]$DataDir = (Join-Path $InstallDir "data"),
    [ValidateSet("comfyui", "demo")]
    [string]$Backend = "comfyui",
    [switch]$DownloadComfyUI,
    [string]$ComfyUiDir = (Join-Path $InstallDir "vendor\ComfyUI"),
    [string]$ModelUrl = "",
    [string]$ModelName = "sd-v1-5-inpainting.safetensors",
    [string]$PythonVersion = "3.12",
    [string]$BoredGamesDbPath = (Join-Path (Resolve-Path (Join-Path $InstallDir "..\..")).Path "server\data\db.json"),
    [string]$PublicHostname = "pix.hoesonly.fans",
    [string]$TunnelUrl = "https://pix.hoesonly.fans",
    [int]$Port = 8765
)

$ErrorActionPreference = "Stop"

function New-InviteKey {
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
    return [Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

function Invoke-Native {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath,
        [string[]]$Arguments = @()
    )

    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$FilePath failed with exit code $LASTEXITCODE."
    }
}

New-Item -ItemType Directory -Force -Path $InstallDir, $DataDir, (Join-Path $InstallDir "runtime") | Out-Null

$venvPython = Join-Path $InstallDir ".venv\Scripts\python.exe"
if (-not (Test-Path $venvPython)) {
    Invoke-Native "py" @("-$PythonVersion", "-m", "venv", (Join-Path $InstallDir ".venv"))
}

Invoke-Native $venvPython @("-m", "pip", "install", "--upgrade", "pip")
Invoke-Native $venvPython @("-m", "pip", "install", "-r", (Join-Path $InstallDir "requirements.txt"))

$invitePath = Join-Path $DataDir "invite-key.txt"
if (-not (Test-Path $invitePath)) {
    New-InviteKey | Set-Content -Path $invitePath -Encoding UTF8
}

if ($DownloadComfyUI) {
    if (-not (Test-Path $ComfyUiDir)) {
        Invoke-Native "git" @("clone", "https://github.com/comfyanonymous/ComfyUI.git", $ComfyUiDir)
    }
    $comfyPython = Join-Path $ComfyUiDir ".venv\Scripts\python.exe"
    if (-not (Test-Path $comfyPython)) {
        Invoke-Native "py" @("-$PythonVersion", "-m", "venv", (Join-Path $ComfyUiDir ".venv"))
    }
    Invoke-Native $comfyPython @("-m", "pip", "install", "--upgrade", "pip")
    Invoke-Native $comfyPython @("-m", "pip", "install", "torch", "torchvision", "torchaudio", "--index-url", "https://download.pytorch.org/whl/cu121")
    Invoke-Native $comfyPython @("-m", "pip", "install", "-r", (Join-Path $ComfyUiDir "requirements.txt"))

    if ($ModelUrl) {
        $modelDir = Join-Path $ComfyUiDir "models\checkpoints"
        New-Item -ItemType Directory -Force -Path $modelDir | Out-Null
        Invoke-WebRequest -Uri $ModelUrl -OutFile (Join-Path $modelDir $ModelName)
    }
}

$envFile = Join-Path $InstallDir "runtime\pixomerck.env.ps1"
@"
`$env:PIXOMERCK_HOST = "0.0.0.0"
`$env:PIXOMERCK_PORT = "$Port"
`$env:PIXOMERCK_DATA_DIR = "$DataDir"
`$env:PIXOMERCK_GAMES_DB_PATH = "$BoredGamesDbPath"
`$env:PIXOMERCK_BACKEND = "$Backend"
`$env:PIXOMERCK_COMFYUI_URL = "http://127.0.0.1:8188"
`$env:PIXOMERCK_MODEL = "$ModelName"
`$env:PIXOMERCK_PUBLIC_HOSTNAME = "$PublicHostname"
`$env:PIXOMERCK_TUNNEL_URL = "$TunnelUrl"
"@ | Set-Content -Path $envFile -Encoding UTF8

Write-Host "Pixomerck server installed."
Write-Host "Invite key: $(Get-Content $invitePath)"
Write-Host "Run: powershell -ExecutionPolicy Bypass -File scripts\start.ps1"
