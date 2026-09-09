#!/bin/sh
set -e

# WORKDIR is /app (monorepo root); node_modules are hoisted here.
# The web app source is at /app/apps/web (bind-mounted in docker-compose.dev.yml).
echo "==> Generando cliente Prisma..."
/app/node_modules/.bin/prisma generate --schema=/app/apps/web/prisma/schema.prisma

echo "==> Aplicando migraciones..."
/app/node_modules/.bin/prisma migrate deploy --schema=/app/apps/web/prisma/schema.prisma

echo "==> Iniciando Next.js (dev)..."
cd /app/apps/web
exec /app/node_modules/.bin/next dev -p "${PORT:-3000}" -H "0.0.0.0"
