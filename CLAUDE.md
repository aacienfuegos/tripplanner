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

## Workflow de desarrollo

1. Hacer cambios
2. `npx tsc --noEmit` — verificar tipos
3. `npm test` — pasar los 33 tests
4. Probar visualmente en `http://localhost:3000`
5. `git commit` con mensaje descriptivo (feat/fix/test/refactor)
