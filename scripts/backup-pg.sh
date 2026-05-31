#!/bin/bash
set -e

BACKUP_DIR="/backups"
DB_NAME="fb_ads_platform"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

docker exec $(docker ps -q -f name=postgres)   pg_dump -U postgres "$DB_NAME" | gzip > "$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.sql.gz"

find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime +7 -delete

echo "Backup: ${DB_NAME}_${TIMESTAMP}.sql.gz"
