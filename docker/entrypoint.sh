#!/bin/sh
set -e

# WORKDIR is /app/apps/web; node_modules are hoisted to /app/node_modules
echo "==> Aplicando migraciones de base de datos..."
/app/node_modules/.bin/prisma migrate deploy

echo "==> Iniciando Next.js (producción)..."
exec /app/node_modules/.bin/next start -p "${PORT:-3000}" -H "${HOSTNAME:-0.0.0.0}"
