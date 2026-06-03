#!/usr/bin/env bash
# Clean install for WSL — fixes EACCES on /mnt/<drive> when pnpm renames node_modules
# (often after npm install on Windows). Run from repo root:
#   bash scripts/wsl-install.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ "$ROOT" == /mnt/* ]]; then
  echo "Note: project is on a Windows drive ($ROOT)."
  echo "      If install fails, use ~/projects clone or scripts/win-install.ps1 on Windows."
  echo ""
fi

command -v pnpm >/dev/null 2>&1 || {
  echo "pnpm not found. Install: corepack enable && corepack prepare pnpm@9.1.0 --activate"
  exit 1
}

echo "=== FB Ads Platform — clean pnpm install (WSL) ==="

remove_modules() {
  local dir="$1"
  if [[ -d "$dir/node_modules" ]]; then
    echo "Removing $dir/node_modules"
    rm -rf "$dir/node_modules"
  fi
}

remove_modules "$ROOT"
for dir in "$ROOT"/apps/* "$ROOT"/packages/*; do
  [[ -d "$dir" ]] || continue
  remove_modules "$dir"
done

# Stale pnpm store links on drvfs can confuse the next install
if [[ -d "$ROOT/node_modules/.pnpm" ]]; then
  rm -rf "$ROOT/node_modules"
fi

echo "Running pnpm install..."
pnpm install

if [[ -f "$ROOT/apps/api/prisma/schema.prisma" ]]; then
  echo "Generating Prisma client..."
  pnpm exec prisma generate --schema="$ROOT/apps/api/prisma/schema.prisma"
fi

echo "=== Done ==="
echo "  pnpm dev          — start dev"
echo "  pnpm --filter web type-check"