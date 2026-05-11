param(
    [string]$BaseUrl = "http://127.0.0.1:8765"
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$InvitePath = Join-Path $Root "data\invite-key.txt"
$Headers = @{}
if (Test-Path $InvitePath) {
    $Headers["X-Pixomerck-Key"] = (Get-Content $InvitePath)
}

Write-Host "Health:"
Invoke-RestMethod -Uri "$BaseUrl/health" -Method Get | ConvertTo-Json -Depth 5

Write-Host "Pairing:"
Invoke-RestMethod -Uri "$BaseUrl/v1/pairing" -Method Get -Headers $Headers | ConvertTo-Json -Depth 5
