# One command for the whole check.
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)
npm run typecheck; if ($LASTEXITCODE -ne 0) { Write-Host "FAIL typecheck"; exit 1 }
npm test; if ($LASTEXITCODE -ne 0) { Write-Host "FAIL tests"; exit 1 }
forge lint; if ($LASTEXITCODE -ne 0) { Write-Host "FAIL forge lint"; exit 1 }
Write-Host "PASS"
