# Runs the mechanical gates of a stage and prints the plugin steps a Claude session still has to run.
# Stages and steps: docs/PIPELINE.md.
param([Parameter(Mandatory = $true)][ValidateSet("daily", "release", "filming", "submission")][string]$Stage)
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

function Gate($name, [scriptblock]$run) {
  & $run
  if ($LASTEXITCODE -ne 0) { Write-Host "FAIL $name"; exit 1 }
  Write-Host "ok   $name"
}

Gate "check" { powershell -File scripts/check.ps1 }

if ($Stage -ne "daily") {
  # A deploy of something that is not committed could not be rolled back to a known state.
  $dirty = git status --porcelain -- src manifest.yml package.json
  if ($dirty) { Write-Host "FAIL uncommitted changes in src, manifest.yml or package.json:"; $dirty; exit 1 }
  Write-Host "ok   src is committed"
}

if ($Stage -eq "submission") {
  # Public files only; the ignored research/ folder and the local plan files are not searched.
  $hits = git grep -n -i -E "api[_-]?key\s*[:=]|secret\s*[:=]|bearer [a-z0-9]{20,}" -- . ":!scripts/models.json" ":!tests" ":!docs/SECURITY.md" ":!docs/PIPELINE.md"
  if ($hits) { Write-Host "FAIL possible secret in a tracked file:"; $hits; exit 1 }
  Write-Host "ok   no key-like text in tracked files"
}

$steps = @{
  daily      = @("productivity:task-management: the day's list", "engineering:code-review on the diff if src/rules changed")
  release    = @("agentic-council release gate: Operator, Skeptic, Guardian, Craftsman (read-only, sonnet)", "engineering:deploy-checklist", "operations:risk-assessment", "after deploy: built-in-browser check of the panel and the Decisions page", "data:validate-data if data/ or scripts/measure changed")
  filming    = @("release steps above", "design:accessibility-review (keyboard, screen reader)", "design:ux-copy on panel text", "agentic-council Advocate on docs/VIDEO.md", "operations:runbook for the demo site state")
  submission = @("release steps above", "agentic-council judge panel: Strategist, Advocate, Skeptic on docs/DEVPOST.md and the README", "tavily for any claim that needs a fresh source", "the owner submits")
}
Write-Host ""
Write-Host "PASS gates for '$Stage'. Plugin steps still to run, in order:"
$steps[$Stage] | ForEach-Object { Write-Host "  - $_" }
