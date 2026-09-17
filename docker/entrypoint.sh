#!/bin/sh
set -e

# WORKDIR is /app/apps/web; node_modules are hoisted to /app/node_modules
echo "==> Aplicando migraciones de base de datos..."
/app/node_modules/.bin/prisma migrate deploy

# SEED_ON_BOOT solo debe existir en el .env de staging — mantiene el usuario
# dummy siempre con el dataset de prueba definido en prisma/seed.ts, sin
# depender de un paso manual en cada despliegue (staging redeploya
# automáticamente vía cron cada 5 min). Separado de ALLOW_DEV_LOGIN (que solo
# controla si el proveedor de credenciales dev existe, ver src/lib/auth.ts)
# porque son cosas distintas: una es superficie de auth, otra es ciclo de
# vida de datos. node ejecuta el .ts nativamente; no hace falta tsx en la
# imagen de producción.
if [ "$SEED_ON_BOOT" = "true" ]; then
  echo "==> SEED_ON_BOOT activo: sembrando datos de prueba del usuario dev..."
  # Un seed roto deja staging sin datos de prueba; no debe dejarlo sin app. Con
  # `set -e` cualquier fallo aquí mataba el contenedor antes de arrancar Next y
  # lo dejaba en bucle de reinicios (502 en staging).
  node prisma/seed.ts || echo "!!! El seed ha fallado; la app arranca igualmente"
fi

echo "==> Iniciando Next.js (producción)..."
exec /app/node_modules/.bin/next start -p "${PORT:-3000}" -H "${HOSTNAME:-0.0.0.0}"
