#!/bin/sh
set -e

echo "==> Generando cliente Prisma..."
node_modules/.bin/prisma generate

echo "==> Aplicando migraciones..."
node_modules/.bin/prisma migrate deploy

echo "==> Iniciando Next.js (dev)..."
exec node_modules/.bin/next dev -p "${PORT:-3000}" -H "0.0.0.0"
