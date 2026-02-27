Param(
  [switch]$NoBuild
)

$ErrorActionPreference = "Stop"

function Run-Step {
  param(
    [string]$Label,
    [string]$Command
  )
  Write-Host ""
  Write-Host "==> $Label" -ForegroundColor Cyan
  Write-Host "    $Command"
  iex $Command
}

Run-Step -Label "Phase 1" -Command "npm run validate:phase1"
Run-Step -Label "Phase 2" -Command "npm run validate:phase2"
Run-Step -Label "Phase 3" -Command "npm run validate:phase3"
Run-Step -Label "Phase 4" -Command "npm run validate:phase4"
Run-Step -Label "Phase 5/6" -Command "npm run validate:phase56"
Run-Step -Label "Phase 7" -Command "npm run validate:phase7"
Run-Step -Label "Phase 8" -Command "npm run validate:phase8"

if (-not $NoBuild) {
  Run-Step -Label "Build" -Command "npm run build"
}

Write-Host ""
Write-Host "[OK] E2E checklist terminee." -ForegroundColor Green
