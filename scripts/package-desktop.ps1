<#
.SYNOPSIS
    Package Harness Desktop into a Windows installer using Electron Forge.

.DESCRIPTION
    Steps:
    1. Package Runtime first (scripts/package-runtime.ps1)
    2. Copy harness-runtime.exe into app resources
    3. Run electron-forge make (Squirrel.Windows)

    Output: out/make/squirrel.windows/x64/harness-desktop-*.exe

.EXAMPLE
    # Package runtime first, then desktop
    .\scripts\package-runtime.ps1
    .\scripts\package-desktop.ps1
#>

$ErrorActionPreference = "Stop"

Write-Host "=== Harness Desktop Packaging ===" -ForegroundColor Cyan

# 1. Check prerequisites
Write-Host "[1/5] Checking prerequisites..."
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Error "pnpm not found. Install with: npm install -g pnpm"
    exit 1
}

$runtime_exe = "dist/harness-runtime.exe"
if (-not (Test-Path $runtime_exe)) {
    Write-Host "Runtime not found. Building..."
    & "$PSScriptRoot/package-runtime.ps1"
}

# 2. Install Electron deps
Write-Host "[2/5] Installing dependencies..."
pnpm install --filter @harness/desktop

# 3. Copy Runtime into Electron resources
Write-Host "[3/5] Bundling Runtime..."
$resources = "apps/desktop/resources"
New-Item -ItemType Directory -Force -Path $resources | Out-Null
Copy-Item $runtime_exe "$resources/harness-runtime.exe" -Force

# 4. TypeCheck + Test
Write-Host "[4/5] Running tests..."
pnpm typecheck
python -m pytest runtime/tests -q

# 5. Build installer
Write-Host "[5/5] Building installer..."
pnpm --filter @harness/desktop package

$installer = Get-ChildItem -Path "out/make" -Recurse -Filter "*.exe" | Select-Object -First 1
if ($installer) {
    $size = [math]::Round($installer.Length / 1MB, 1)
    Write-Host "Done! $($installer.FullName) ($size MB)" -ForegroundColor Green
} else {
    Write-Host "Build may have completed. Check out/make/ for output." -ForegroundColor Yellow
}
