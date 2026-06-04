#!/usr/bin/env bash
# apps/web/scripts/check-legacy-ui.sh
set -euo pipefail
cd "$(dirname "$0")/.."

PATHS=(
  src/app/dashboard
  src/components/layout
  src/components/campaigns
  src/components/TargetingBuilder.tsx
  src/components/ui/DataTable.tsx
  src/components/ui/ConnectionBanner.tsx
)

ALLOWLIST="scripts/legacy-ui-allowlist.txt"
# ไฟล์ใน allowlist ข้ามจนกว่า PR จะลบ entry (เช่น campaigns/page.tsx จน PR-5b)

should_skip() {
  local file="$1"
  [[ -f "$ALLOWLIST" ]] || return 1
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "${line// }" ]] && continue
    [[ "$file" == *"$line"* ]] && return 0
  done < "$ALLOWLIST"
  return 1
}

FAIL=0
while IFS= read -r -d '' f; do
  should_skip "$f" && continue
  if rg -n \
    -e '\b(btn-primary|btn-secondary|btn-ghost|btn-danger)\b' \
    -e '\bmsg-(success|error|info)\b' \
    -e 'className=["'\''][^"'\'']*\bcard\b' \
    -e 'className=\{\s*`[^`]*\bcard\b' \
    -e "className=\\{\\s*'[^']*\\bcard\\b" \
    -e '\bcn\([^)]*['\''"]card\b' \
    "$f"; then
    FAIL=1
  fi
done < <(find "${PATHS[@]}" -type f \( -name '*.tsx' -o -name '*.ts' \) -print0 2>/dev/null)

if [[ "$FAIL" -ne 0 ]]; then
  echo "FAIL: legacy UI classes found (see above)"
  exit 1
fi
echo "OK: no legacy btn/msg/card patterns in scoped paths (allowlist applied)"