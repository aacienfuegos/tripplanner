#!/usr/bin/env bash
# scripts/deploy.sh — deploy a staging o producción
# Uso: bash scripts/deploy.sh <staging|production>
#
# Prerequisitos en el servidor:
#   - .env.staging o .env.prod en la raíz del repo
#   - docker y docker compose v2 instalados
#   - El usuario que ejecuta este script está en el grupo docker

set -euo pipefail

# ── Validación del argumento ───────────────────────────────────────────────────
ENVIRONMENT="${1:-}"
if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
  echo "ERROR: El primer argumento debe ser 'staging' o 'production'." >&2
  echo "Uso: bash scripts/deploy.sh <staging|production>" >&2
  exit 1
fi

# ── Configuración por entorno ──────────────────────────────────────────────────
if [[ "$ENVIRONMENT" == "staging" ]]; then
  COMPOSE_PROJECT="tripplanner-staging"
  COMPOSE_FILE="docker-compose.staging.yml"
  ENV_FILE=".env.staging"
  HEALTH_PORT="3001"
  GIT_BRANCH="develop"
else
  COMPOSE_PROJECT="tripplanner-prod"
  COMPOSE_FILE="docker-compose.prod.yml"
  ENV_FILE=".env.prod"
  HEALTH_PORT="3000"
  GIT_BRANCH="main"
fi

# ── Raíz del repo ──────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "==> [$ENVIRONMENT] Desplegando desde: $REPO_ROOT"
cd "$REPO_ROOT"

# ── El fichero de entorno debe existir ────────────────────────────────────────
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE no encontrado en $REPO_ROOT." >&2
  echo "Copia el ejemplo y rellena los valores:" >&2
  if [[ "$ENVIRONMENT" == "staging" ]]; then
    echo "  cp .env.staging.example .env.staging && nano .env.staging" >&2
  else
    echo "  cp .env.prod.example .env.prod && nano .env.prod" >&2
  fi
  exit 1
fi

# Leer APP_PORT del .env si está definido (permite personalizar el puerto sin tocar el script)
ENV_APP_PORT=$(grep -E '^APP_PORT=' "$ENV_FILE" | cut -d'=' -f2 | tr -d '"' | tr -d "'" | tr -d ' ')
if [[ -n "$ENV_APP_PORT" ]]; then
  HEALTH_PORT="$ENV_APP_PORT"
fi

# ── Actualizar código ──────────────────────────────────────────────────────────
echo "==> [$ENVIRONMENT] Actualizando código desde origin/$GIT_BRANCH..."
git fetch origin "$GIT_BRANCH"
git checkout "$GIT_BRANCH"
git reset --hard "origin/$GIT_BRANCH"

# ── Construir y arrancar ───────────────────────────────────────────────────────
echo "==> [$ENVIRONMENT] Construyendo y arrancando contenedores..."
docker compose \
  -p "$COMPOSE_PROJECT" \
  -f "$COMPOSE_FILE" \
  --env-file "$ENV_FILE" \
  up --build -d

# ── Health check ───────────────────────────────────────────────────────────────
echo "==> [$ENVIRONMENT] Esperando a que la app esté disponible..."
MAX_RETRIES=24   # 24 × 5s = 2 minutos (migrate deploy puede tardar)
RETRY_INTERVAL=5
HEALTH_URL="http://127.0.0.1:${HEALTH_PORT}"

for i in $(seq 1 $MAX_RETRIES); do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$HEALTH_URL" || true)
  # NextAuth redirige / a /auth/signin (302/307), también es señal de que arrancó
  if [[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "302" || "$HTTP_CODE" == "307" ]]; then
    echo "==> [$ENVIRONMENT] App disponible (HTTP $HTTP_CODE). Deploy completado."
    exit 0
  fi
  echo "    Intento $i/$MAX_RETRIES — HTTP $HTTP_CODE, reintentando en ${RETRY_INTERVAL}s..."
  sleep "$RETRY_INTERVAL"
done

echo "ERROR: [$ENVIRONMENT] Health check fallido tras $((MAX_RETRIES * RETRY_INTERVAL))s." >&2
echo "       Revisar logs: docker compose -p $COMPOSE_PROJECT -f $COMPOSE_FILE logs --tail=50" >&2
exit 1
