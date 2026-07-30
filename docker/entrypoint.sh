#!/bin/sh
set -e

# WORKDIR is /app/apps/web; node_modules are hoisted to /app/node_modules
echo "==> Aplicando migraciones de base de datos..."
/app/node_modules/.bin/prisma migrate deploy

# ALLOW_DEV_LOGIN solo debe existir en el .env de staging (ver src/lib/auth.ts)
# — reutilizarlo aquí mantiene el usuario dummy siempre con el dataset de
# prueba definido en prisma/seed.ts, sin depender de un paso manual en cada
# despliegue (staging redeploya automáticamente vía cron cada 5 min). node
# ejecuta el .ts nativamente; no hace falta tsx en la imagen de producción.
if [ "$ALLOW_DEV_LOGIN" = "true" ]; then
  echo "==> ALLOW_DEV_LOGIN activo: sembrando datos de prueba del usuario dev..."
  node prisma/seed.ts
fi

echo "==> Iniciando Next.js (producción)..."
exec /app/node_modules/.bin/next start -p "${PORT:-3000}" -H "${HOSTNAME:-0.0.0.0}"
