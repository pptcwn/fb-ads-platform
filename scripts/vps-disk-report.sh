#!/usr/bin/env bash
# Run on VPS as root: bash scripts/vps-disk-report.sh
set -euo pipefail

echo "=== Filesystem ==="
df -hT / /var/lib/docker 2>/dev/null || df -hT /

echo ""
echo "=== Top-level directories (/) ==="
du -xh --max-depth=1 / 2>/dev/null | sort -hr | head -20

echo ""
echo "=== /var/lib/docker breakdown ==="
if [ -d /var/lib/docker ]; then
  du -xh --max-depth=1 /var/lib/docker 2>/dev/null | sort -hr | head -15
fi

echo ""
echo "=== Docker disk usage (summary) ==="
docker system df -v 2>/dev/null || docker system df 2>/dev/null || echo "(docker not available)"

echo ""
echo "=== Largest Docker images ==="
docker images --format '{{.Size}}\t{{.Repository}}:{{.Tag}}' 2>/dev/null | sort -hr | head -15 || true

echo ""
echo "=== Container writable layers ==="
docker ps -as 2>/dev/null || true

echo ""
echo "=== Project dir (/root/fb-ads-platform) ==="
if [ -d /root/fb-ads-platform ]; then
  du -xh --max-depth=1 /root/fb-ads-platform 2>/dev/null | sort -hr | head -15
fi

echo ""
echo "=== Docker volumes ==="
docker volume ls 2>/dev/null || true
du -sh /var/lib/docker/volumes/* 2>/dev/null | sort -hr | head -10 || true

echo ""
echo "=== Journal logs (if large) ==="
journalctl --disk-usage 2>/dev/null || true

echo ""
echo "=== Recommendations if / > 85% ==="
echo "  docker system prune -af"
echo "  docker builder prune -af"
echo "  docker volume prune -f   # only if you accept losing unused volumes"
echo "  truncate -s 0 /var/lib/docker/containers/*/*-json.log  # shrink container logs"