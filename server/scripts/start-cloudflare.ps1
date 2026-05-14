param(
    [string]$ConfigPath = (Join-Path $env:USERPROFILE ".cloudflared\pixomerck.yml"),
    [string]$TunnelName = "pixomerck",
    [string]$CloudflaredPath = ""
)

$ErrorActionPreference = "Stop"

$cloudflared = $CloudflaredPath
if (-not $cloudflared) {
    $cmd = Get-Command cloudflared -ErrorAction SilentlyContinue
    if ($cmd) {
        $cloudflared = $cmd.Source
    }
}
if (-not $cloudflared -or -not (Test-Path $cloudflared)) {
    throw "cloudflared was not found. Add it to PATH or pass -CloudflaredPath."
}
if (-not (Test-Path $ConfigPath)) {
    throw "Cloudflare config not found at $ConfigPath. Run scripts\cloudflare-pix.ps1 first."
}

& $cloudflared tunnel --config $ConfigPath run $TunnelName
