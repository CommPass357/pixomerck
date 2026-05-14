param(
    [string]$Hostname = "pix.hoesonly.fans",
    [string]$ServiceUrl = "http://127.0.0.1:8765",
    [string]$TunnelName = "pixomerck",
    [string]$ConfigDir = (Join-Path $env:USERPROFILE ".cloudflared"),
    [string]$CloudflaredPath = ""
)

$ErrorActionPreference = "Stop"

function Get-Cloudflared {
    if ($CloudflaredPath) {
        if (Test-Path $CloudflaredPath) {
            return (Resolve-Path $CloudflaredPath).Path
        }
        throw "cloudflared was not found at $CloudflaredPath."
    }
    $cmd = Get-Command cloudflared -ErrorAction SilentlyContinue
    if ($cmd) {
        return $cmd.Source
    }
    throw "cloudflared was not found on PATH. Install it first, add cloudflared.exe to PATH, or pass -CloudflaredPath."
}

$cloudflared = Get-Cloudflared
New-Item -ItemType Directory -Force -Path $ConfigDir | Out-Null

Write-Host "This script creates or reuses a named Cloudflare Tunnel for $Hostname."
Write-Host "If cloudflared is not authenticated, run: cloudflared tunnel login"

$tunnelsJson = & $cloudflared tunnel list --output json 2>$null
$tunnels = @()
if ($LASTEXITCODE -eq 0 -and $tunnelsJson) {
    $tunnels = $tunnelsJson | ConvertFrom-Json
}

$existingTunnel = $tunnels | Where-Object { $_.name -eq $TunnelName } | Select-Object -First 1
if (-not $existingTunnel) {
    & $cloudflared tunnel create $TunnelName
    $tunnelsJson = & $cloudflared tunnel list --output json
    $tunnels = $tunnelsJson | ConvertFrom-Json
    $existingTunnel = $tunnels | Where-Object { $_.name -eq $TunnelName } | Select-Object -First 1
}

$tunnelId = $existingTunnel.id
if (-not $tunnelId) {
    throw "Could not resolve Cloudflare tunnel id for $TunnelName."
}

$credentials = Join-Path $ConfigDir "$tunnelId.json"
$configPath = Join-Path $ConfigDir "pixomerck.yml"

@"
tunnel: $tunnelId
credentials-file: $credentials

ingress:
  - hostname: $Hostname
    service: $ServiceUrl
  - service: http_status:404
"@ | Set-Content -Path $configPath -Encoding UTF8

& $cloudflared tunnel route dns $TunnelName $Hostname

Write-Host "Cloudflare route ready: https://$Hostname -> $ServiceUrl"
Write-Host "Run this tunnel with:"
Write-Host "cloudflared tunnel --config `"$configPath`" run $TunnelName"
