#!/bin/bash
set -e

echo "=== FB Ads Platform Setup ==="

# Check Docker
command -v docker >/dev/null 2>&1 || { echo "Docker required"; exit 1; }

# .env
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env"
fi

# Secrets
mkdir -p secrets
if [ ! -f secrets/token_encryption_key.txt ]; then
  openssl rand -hex 32 > secrets/token_encryption_key.txt
  echo "Generated token encryption key"
fi

# Install deps
pnpm install

# Prisma
cd apps/api && npx prisma generate && cd ../..

# Start
docker compose up -d --build

echo "=== Setup complete ==="
echo "  Frontend: http://localhost:3000"
echo "  API:      http://localhost:4000"
