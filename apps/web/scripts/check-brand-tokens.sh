#!/usr/bin/env bash
# ห้าม Tailwind brand ผ่าน accent.* นอก shadcn ui/
set -euo pipefail
cd "$(dirname "$0")/.."

PATHS=(src/app/dashboard src/components/layout src/components/campaigns \
  src/components/TargetingBuilder.tsx src/components/ui/DataTable.tsx)

if rg -n '\b(bg|text|border|ring)-accent(-[a-z0-9]+)?\b' "${PATHS[@]}"; then
  echo "FAIL: use brand.* not accent.* for Vercel blue in app code"
  exit 1
fi
echo "OK: no Tailwind accent.* brand usage in scoped paths"