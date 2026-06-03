#!/bin/bash
set -e

DISK=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
MEM=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100}')
CPU=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d. -f1)
UNHEALTHY=$(docker ps -a --filter "health=unhealthy" --format "{{.Names}}")

ALERTS=""
[ "$DISK" -gt 80 ] && ALERTS+="Disk: ${DISK}%\n"
[ "$MEM" -gt 85 ] && ALERTS+="Memory: ${MEM}%\n"
[ "$CPU" -gt 90 ] && ALERTS+="CPU: ${CPU}%\n"
[ -n "$UNHEALTHY" ] && ALERTS+="Unhealthy: $UNHEALTHY\n"

[ -n "$ALERTS" ] && echo -e "VPS Health Alert\n${ALERTS}"
