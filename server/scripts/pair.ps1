param(
    [string]$BaseUrl = "http://127.0.0.1:8765"
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$InvitePath = Join-Path $Root "data\invite-key.txt"

if (-not (Test-Path $InvitePath)) {
    throw "Invite key not found. Run scripts\install.ps1 first."
}

$InviteKey = Get-Content $InvitePath

Write-Host "Pixomerck API access"
Write-Host "Server URL: $BaseUrl"
Write-Host "API key: $InviteKey"
