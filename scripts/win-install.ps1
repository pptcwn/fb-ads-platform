# Clean pnpm install on Windows (F: drive, PowerShell).
# Use when WSL pnpm fails with EACCES on /mnt/f.
#   cd F:\0P\fb-ads-platform
#   .\scripts\win-install.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Error "pnpm not found. Run: corepack enable; corepack prepare pnpm@9.1.0 --activate"
}

Write-Host "=== FB Ads Platform — clean pnpm install (Windows) ==="

function Remove-NodeModules([string]$Dir) {
    $nm = Join-Path $Dir "node_modules"
    if (Test-Path $nm) {
        Write-Host "Removing $nm"
        Remove-Item -Recurse -Force $nm
    }
}

Remove-NodeModules $Root
Get-ChildItem -Path (Join-Path $Root "apps"), (Join-Path $Root "packages") -Directory -ErrorAction SilentlyContinue |
    ForEach-Object { Remove-NodeModules $_.FullName }

Write-Host "Running pnpm install..."
pnpm install

$schema = Join-Path $Root "apps\api\prisma\schema.prisma"
if (Test-Path $schema) {
    Write-Host "Generating Prisma client..."
    pnpm exec prisma generate --schema=$schema
}

Write-Host "=== Done ==="
Write-Host "  pnpm dev"
Write-Host "  pnpm --filter web type-check"