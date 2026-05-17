#!/bin/sh
set -e

echo "==> Aplicando migraciones de base de datos..."
node_modules/.bin/prisma migrate deploy

echo "==> Iniciando Next.js (producción)..."
exec node_modules/.bin/next start -p "${PORT:-3000}" -H "${HOSTNAME:-0.0.0.0}"
