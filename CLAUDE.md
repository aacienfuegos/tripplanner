@AGENTS.md

# TripPlanner

Webapp de organización de viajes. Next.js 16 + TypeScript + Tailwind + shadcn/ui + PostgreSQL + Prisma 7 + NextAuth v5.

## Stack y versiones críticas

| Tecnología | Versión | Breaking changes relevantes |
|---|---|---|
| Next.js | 16.2.6 | `middleware.ts` → `proxy.ts`, export `proxy` no `middleware` |
| Prisma | 7.x | `url` eliminado de `schema.prisma`; va en `prisma.config.ts`. Requiere driver adapter (`@prisma/adapter-pg`) |
| NextAuth | v5 beta | Split edge/node: `auth.config.ts` (edge-safe) + `auth.ts` (Node+Prisma) |
| shadcn/ui | 4.7.0 | Usa `@base-ui/react` en vez de Radix. **`asChild` NO existe**. Usar `buttonVariants()` + `<Link>` |

## Comandos de desarrollo

```bash
# Levantar la base de datos (Docker)
docker start tripplanner-db    # si ya existe
docker run --name tripplanner-db -e POSTGRES_USER=tripuser \
  -e POSTGRES_PASSWORD=tripdev123 -e POSTGRES_DB=tripplanner \
  -p 5432:5432 -d postgres:16-alpine   # primera vez

# Dev server
npm run dev          # http://localhost:3000

# Base de datos
npx prisma migrate dev    # aplicar migraciones
npx prisma db seed        # cargar datos de prueba
npx prisma studio         # explorar la DB en el navegador

# Tests (siempre antes de commitear)
npm test              # vitest run (modo CI)
npm run test:watch    # modo watch

# TypeScript
npx tsc --noEmit      # check de tipos sin compilar
```

## Autenticación local (dev)

Credenciales fijas vía `.env`:
- Email: `admin@dev.local`
- Password: `admin123`
- User ID fijo: `dev-local-user-001`

El usuario dev se crea automáticamente en la DB en el primer login (`events.signIn` en `auth.ts`).

## Arquitectura de archivos clave

```
src/
├── app/
│   ├── (app)/          # Rutas protegidas (layout con navbar + guard de auth)
│   │   ├── dashboard/
│   │   └── trips/[id]/ # Secciones: flights, accommodations, activities,
│   │                   # expenses, packing, documents
│   └── auth/           # signin, error (rutas públicas)
├── actions/            # Server Actions para CRUD. Todos hacen requireTripOwner()
├── components/
│   ├── layout/         # Navbar
│   ├── trips/          # Formularios de viaje
│   └── ui/             # shadcn/ui components
├── lib/
│   ├── auth.config.ts  # Configuración NextAuth edge-safe (sin Prisma)
│   ├── auth.ts         # NextAuth completo con PrismaAdapter + dev credentials
│   ├── prisma.ts       # Singleton PrismaClient con PrismaPg adapter
│   └── schemas.ts      # Schemas Zod compartidos entre actions y tests
└── proxy.ts            # Next.js 16: reemplaza middleware.ts

# Infraestructura de despliegue
.github/workflows/
├── deploy-staging.yml      # Auto-deploy a staging en cada push a develop
└── deploy-production.yml   # Deploy manual a producción (workflow_dispatch + confirm)
docker/
├── nginx-host.conf         # Template nginx host para producción (:3000)
├── nginx-staging-host.conf # Template nginx host para staging (:8072)
├── entrypoint.sh           # Entrypoint prod: prisma migrate deploy + next start
└── entrypoint.dev.sh       # Entrypoint dev: prisma generate + migrate + next dev
scripts/
└── deploy.sh               # Script de deploy unificado (staging|production)
docker-compose.prod.yml     # Producción: APP_PORT=8082, volumen db_data_prod
docker-compose.staging.yml  # Staging: APP_PORT=8072, volumen db_data_staging
docker-compose.dev.yml      # Desarrollo local con hot-reload
.env.prod.example           # Variables requeridas en el servidor para producción
.env.staging.example        # Variables requeridas en el servidor para staging
```

## Patrones importantes

### Links con estilos de botón (shadcn 4.7)
```tsx
// CORRECTO — @base-ui no tiene asChild
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";
<Link href="/ruta" className={buttonVariants({ variant: "outline" })}>Texto</Link>

// INCORRECTO — no funciona en esta versión
<Button asChild><Link>...</Link></Button>
```

### Server Actions
```ts
// Todas las actions privadas siguen este patrón:
async function requireTripOwner(tripId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { userId: true } });
  if (!trip || trip.userId !== session.user.id) redirect("/trips");
}
```

### Proxy (auth middleware) — Next.js 16
```ts
// src/proxy.ts — NO importar Prisma aquí (edge runtime)
export async function proxy(request: NextRequest) { return auth(request as any); }
export const config = { matcher: [...] };
```

## Entornos

| Entorno | URL | Rama | Deploy |
|---|---|---|---|
| Local | `http://localhost:3000` | cualquiera | `npm run dev` |
| Staging | `https://staging.trips.ciencre.xyz` | `develop` | Automático al hacer push a `develop` |
| Producción | `https://trips.ciencre.xyz` | `main` | Manual vía GitHub Actions (ver abajo) |

Cada entorno tiene su propia base de datos PostgreSQL y su propio fichero `.env` en el servidor (nunca en git):
- `.env` → local (sí va en git para dev)
- `.env.staging` → staging (en el servidor)
- `.env.prod` → producción (en el servidor)

### Deploy manual desde el servidor

```bash
bash scripts/deploy.sh staging     # rebuild staging y arranca
bash scripts/deploy.sh production  # rebuild prod y arranca
```

### Deploy desde GitHub Actions

```
Staging:     automático — cualquier push a develop lo dispara
Producción:  Actions → "Deploy to Production" → Run workflow → escribir "yes"
```

El script `scripts/deploy.sh` es el mismo en ambos casos: hace `git checkout -B <rama> origin/<rama>` (develop para staging, main para prod), reconstruye la imagen Docker y espera a que la app responda (acepta HTTP 200/302/307) antes de declarar éxito.

El entorno `production` en GitHub tiene **required reviewers** activado: aunque alguien dispare el workflow, el deploy queda pausado hasta que el propietario lo apruebe desde la UI de Actions.

## Workflow de desarrollo

### Estrategia de ramas

```
feat/nombre-N  ──PR──►  develop  ──PR──►  main
                            │                │
                         staging          producción
                       (auto-deploy)       (manual)
```

- `develop` es la rama de integración: recibe features, auto-despliega a staging.
- `main` es la rama de producción: solo recibe merges desde `develop` cuando staging está validado.
- Nunca trabajar directo en `develop` ni en `main`.

### Pasos para cada feature

1. Crear issue en GitHub con labels (`feature`/`bug`, `size:xs/s/m/l/xl`, categoría)
2. Crear rama desde `develop`: `feat/nombre-issue-N` o `fix/nombre-issue-N`
3. Implementar los cambios
4. `npx tsc --noEmit` — verificar tipos sin excepción
5. `npm test` — pasar todos los tests sin excepción
6. Probar visualmente en `http://localhost:3000`
7. Commit con prefijo convencional (feat/fix/refactor) y cuerpo explicativo
8. PR hacia `develop` con `Closes #N` en el body
9. El merge a `develop` dispara el deploy automático a staging
10. Revisar en staging (`https://staging.trips.ciencre.xyz`). Si está bien, PR de `develop → main`
11. Merge a `main` → ir a GitHub Actions → "Deploy to Production" → Run workflow → escribir `"yes"` → aprobar cuando llegue la notificación

**Project board:** https://github.com/users/aacienfuegos/projects/1

## Patrones extra

### redirect() en server actions — Next.js
`redirect()` lanza un error especial que los bloques `catch` capturan como error real:
```ts
import { isRedirectError } from "next/dist/client/components/redirect-error";
try {
  await someAction(formData);
} catch (error) {
  if (isRedirectError(error)) throw error; // dejar pasar el redirect
  toast.error("Error");
}
```

### Después de cualquier `prisma migrate dev`
Siempre ejecutar también `npx prisma generate` — la migración actualiza la DB pero no el cliente TypeScript.
