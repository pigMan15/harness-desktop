<#
.SYNOPSIS
    Package Harness Desktop Runtime into a standalone .exe using PyInstaller.

.DESCRIPTION
    Steps:
    1. Ensure Python 3.11+ and PyInstaller are installed
    2. Build harness-runtime.exe (single-file, ~10-15MB)
    3. Verify the binary starts

.EXAMPLE
    .\scripts\package-runtime.ps1
#>

$ErrorActionPreference = "Stop"

Write-Host "=== Harness Desktop Runtime Packaging ===" -ForegroundColor Cyan

# 1. Check prerequisites
Write-Host "[1/4] Checking prerequisites..."
$python = (Get-Command py -ErrorAction SilentlyContinue) ?? (Get-Command python -ErrorAction SilentlyContinue)
if (-not $python) {
    Write-Error "Python 3.11+ not found. Install from https://python.org"
    exit 1
}

# 2. Install build deps
Write-Host "[2/4] Installing PyInstaller..."
pip install pyinstaller --quiet
pip install -e runtime[dev] --quiet

# 3. Build
Write-Host "[3/4] Building harness-runtime.exe..."
py -3 -m PyInstaller runtime/harness-runtime.spec --clean --noconfirm

# 4. Verify
$exe = "dist/harness-runtime.exe"
if (Test-Path $exe) {
    $size = [math]::Round((Get-Item $exe).Length / 1MB, 1)
    Write-Host "[4/4] Done! $exe ($size MB)" -ForegroundColor Green

    # Quick smoke test (token not set = exit 1, which is expected)
    Write-Host "Smoke test:"
    $env:HARNESS_RUNTIME_TOKEN = ""
    & $exe 2>&1 | Select-Object -First 3
    Write-Host "(exit with error is expected — HARNESS_RUNTIME_TOKEN not set)"
} else {
    Write-Error "Build failed: $exe not found"
    exit 1
}
