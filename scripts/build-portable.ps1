# scripts/build-portable.ps1
# Automated Portable Executable Packaging Script for Universal Windows LED Controller

$ErrorActionPreference = "Stop"
$root = "G:\Light Test"
$releaseDir = Join-Path $root "release"
$targetExe = Join-Path $releaseDir "LightControl-Portable.exe"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Building Portable Windows LED Controller Executable      " -ForegroundColor Cyan
Write-Host " Target: $targetExe" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Ensure build & release directories exist
if (!(Test-Path $releaseDir)) {
    New-Item -ItemType Directory -Path $releaseDir -Force | Out-Null
}

# 2. Re-compile C# WinRT BLE Helper if needed
$bleHelperDir = Join-Path $root "packages\adapters\src\sp530e\ble-helper"
$bleHelperExe = Join-Path $bleHelperDir "Sp530eBleHelper.exe"
if (!(Test-Path $bleHelperExe)) {
    Write-Host "[1/6] Compiling C# WinRT BLE Helper..." -ForegroundColor Yellow
    Push-Location $bleHelperDir
    powershell -ExecutionPolicy Bypass -File "build.ps1"
    Pop-Location
} else {
    Write-Host "[1/6] C# WinRT BLE Helper verified: $bleHelperExe" -ForegroundColor Green
}

# 3. Generate high-resolution icons
Write-Host "[2/6] Generating application icons..." -ForegroundColor Yellow
powershell -ExecutionPolicy Bypass -File (Join-Path $root "scripts\generate-icon.ps1")

# 4. Run full test suite
Write-Host "[3/6] Running full test suite (75 tests)..." -ForegroundColor Yellow
Push-Location $root
$testOutput = npm test
if ($LASTEXITCODE -ne 0) {
    Write-Error "Test suite failed! Aborting packaging."
}
Write-Host "All unit, protocol, and adapter tests PASSED." -ForegroundColor Green
Pop-Location

# 5. Build Desktop Renderer and Electron Main Process
Write-Host "[4/6] Building production web and electron bundles..." -ForegroundColor Yellow
Push-Location (Join-Path $root "apps\desktop")
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Desktop build failed! Aborting packaging."
}
Write-Host "Desktop bundles built successfully." -ForegroundColor Green

# 6. Package single portable executable with electron-builder
Write-Host "[5/6] Packaging single portable executable (x64)..." -ForegroundColor Yellow
npx electron-builder --config electron-builder.json --win portable
if ($LASTEXITCODE -ne 0) {
    Write-Error "electron-builder portable packaging failed!"
}
Pop-Location

# 7. Verification of Output Artifact
Write-Host "[6/6] Verifying output artifact..." -ForegroundColor Yellow
if (Test-Path $targetExe) {
    $item = Get-Item $targetExe
    $sizeMB = [math]::Round($item.Length / 1MB, 2)
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host " SUCCESS: Portable Windows Executable Generated!         " -ForegroundColor Green
    Write-Host " Path: $($item.FullName)" -ForegroundColor Green
    Write-Host " Size: $sizeMB MB ($($item.Length) bytes)" -ForegroundColor Green
    Write-Host " Target Architecture: Windows x64 (Portable)" -ForegroundColor Green
    Write-Host " Installer Wizard: NONE (Standalone Single File)" -ForegroundColor Green
    Write-Host " Node.js Required on Target: NO (Self-Contained)" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green
} else {
    Write-Error "Expected portable executable not found at $targetExe!"
}
