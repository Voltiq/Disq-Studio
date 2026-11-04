# Builds Disq Studio and its installer:
#   release\Disq Studio Setup <version>.exe
#
# Usage (from the project folder):
#   npm run installer
#
# Update files (the .sig the auto-updater checks) are signed with the key in
# %USERPROFILE%\.tauri\disq-studio.key when it's there; without it the
# installer is built without them. Releases on GitHub are built and signed by
# .github/workflows/release.yml instead.

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent

# Cargo output stays out of OneDrive; it's thousands of files.
if (-not $env:CARGO_TARGET_DIR) {
    $env:CARGO_TARGET_DIR = Join-Path $env:LOCALAPPDATA "cargo-target\disk-studio"
}
$cargoBin = Join-Path $env:USERPROFILE ".cargo\bin"
if ((Test-Path $cargoBin) -and ($env:Path -notlike "*$cargoBin*")) {
    $env:Path = "$cargoBin;$env:Path"
}

$key = Join-Path $env:USERPROFILE ".tauri\disq-studio.key"
$extra = @()
if (-not $env:TAURI_SIGNING_PRIVATE_KEY -and (Test-Path $key)) {
    $env:TAURI_SIGNING_PRIVATE_KEY = Get-Content $key -Raw
    if (-not $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD) { $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "" }
}
if (-not $env:TAURI_SIGNING_PRIVATE_KEY) {
    Write-Host "No updater key found: building without update files." -ForegroundColor Yellow
    $extra = @("--config", '{"bundle":{"createUpdaterArtifacts":false}}')
}

Write-Host "`n== Building Disq Studio and its installer" -ForegroundColor Cyan
Push-Location $root
try {
    npx tauri build @extra
    if ($LASTEXITCODE -ne 0) { throw "The build failed (exit code $LASTEXITCODE)" }
} finally {
    Pop-Location
}

$version = (Get-Content (Join-Path $root "src-tauri\tauri.conf.json") -Raw | ConvertFrom-Json).version
$built = Get-ChildItem (Join-Path $env:CARGO_TARGET_DIR "release\bundle\nsis") -Filter "*_${version}_*-setup.exe" |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $built) { throw "No installer for version $version was found in $env:CARGO_TARGET_DIR\release\bundle\nsis" }

$releaseDir = Join-Path $root "release"
New-Item -ItemType Directory -Force $releaseDir | Out-Null
$output = Join-Path $releaseDir "Disq Studio Setup $version.exe"
Copy-Item $built.FullName $output -Force

$hash = (Get-FileHash $output -Algorithm SHA256).Hash
$size = [math]::Round((Get-Item $output).Length / 1MB, 1)
Write-Host "`nInstaller ready: $output ($size MB)" -ForegroundColor Green
Write-Host "SHA-256: $hash"
