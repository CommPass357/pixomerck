param(
    [string]$Version = "0.1.0",
    [string]$OutputDir = (Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path "dist")
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$zip = Join-Path $OutputDir "Pixomerck-Windows-Server-v$Version.zip"
if (Test-Path $zip) {
    Remove-Item -LiteralPath $zip -Force
}

$stage = Join-Path $OutputDir "_server_package"
if (Test-Path $stage) {
    Remove-Item -LiteralPath $stage -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $stage | Out-Null

Copy-Item -LiteralPath (Join-Path $Root "requirements.txt") -Destination $stage
Copy-Item -LiteralPath (Join-Path $Root "README.md") -Destination $stage
Copy-Item -LiteralPath (Join-Path $Root "src") -Destination $stage -Recurse
Copy-Item -LiteralPath (Join-Path $Root "scripts") -Destination $stage -Recurse

Get-ChildItem -LiteralPath $stage -Recurse -Directory -Filter "__pycache__" | Remove-Item -Recurse -Force
Get-ChildItem -LiteralPath $stage -Recurse -File -Filter "*.pyc" | Remove-Item -Force

Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $zip
Remove-Item -LiteralPath $stage -Recurse -Force
Get-FileHash -Algorithm SHA256 $zip | ForEach-Object {
    "$($_.Hash.ToLower())  $(Split-Path $zip -Leaf)"
} | Set-Content -Path "$zip.sha256" -Encoding ASCII

Write-Host $zip
