param(
    [string]$BaseUrl = "http://127.0.0.1:8765",
    [string]$WebUrl = "https://pix.hoesonly.fans",
    [switch]$CopyWebLink
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$InvitePath = Join-Path $Root "data\invite-key.txt"

if (-not (Test-Path $InvitePath)) {
    throw "Invite key not found. Run scripts\install.ps1 first."
}

$InviteKey = Get-Content $InvitePath
$EncodedKey = [System.Uri]::EscapeDataString($InviteKey)
$WebPairingLink = "$($WebUrl.TrimEnd('/'))/#pixomerck-key=$EncodedKey"

Write-Host "Pixomerck browser login"
Write-Host "Server URL: $BaseUrl"
Write-Host "Password: $InviteKey"
Write-Host "Web pairing link: $WebPairingLink"

if ($CopyWebLink) {
    Set-Clipboard -Value $WebPairingLink
    Write-Host "Copied web pairing link to clipboard."
}
