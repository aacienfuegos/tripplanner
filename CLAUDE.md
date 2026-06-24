@AGENTS.md

# TripPlanner — Monorepo

Dos aplicaciones que comparten lógica de importación IA:
- **`apps/web`** — Webapp Next.js 16 (PostgreSQL + Prisma 7 + NextAuth v5)
- **`apps/android`** — App Expo/React Native (SQLite local, sin auth, con límite free/pro)
- **`packages/shared`** — Schemas Zod e importación IA compartidos

## Estructura del monorepo

```
tripplanner/
├── apps/
│   ├── web/             # Next.js app (ver sección WEB más abajo)
│   └── android/         # Expo app (ver sección ANDROID más abajo)
├── packages/
│   └── shared/          # @tripplanner/shared — fuente de verdad para:
│       ├── import-schemas.ts   # Zod schemas de las 6 secciones
│       ├── import-prompt.ts    # Generador de prompts para la IA
│       └── index.ts            # Re-exporta todo
├── docker/              # Entrypoints Docker (web)
├── docker-compose.*.yml # Configs Docker (web)
├── .github/workflows/   # CI/CD (web)
└── package.json         # Workspace root (workspaces: apps/web, apps/android, packages/*)
```

**Ambas apps usan React 19** — no hay conflicto de versiones. `apps/android` está en el workspace npm junto con `apps/web`. Los comandos de la web se ejecutan desde la raíz con `--workspace=apps/web`; los de Android desde `apps/android/` directamente (Expo CLI).

## Paquete compartido (`packages/shared`)

Importar desde `@tripplanner/shared` en ambas apps:
```ts
import { importPayloadSchema, ImportPayload, generateImportPrompt } from "@tripplanner/shared";
```

Los alias TypeScript están configurados en `tsconfig.json` de cada app:
```json
"paths": {
  "@tripplanner/shared": ["../../packages/shared/index.ts"]
}
```

---

## WEB (`apps/web`)

### Stack y versiones críticas

| Tecnología | Versión | Breaking changes relevantes |
|---|---|---|
| Next.js | 16.2.6 | `middleware.ts` → `proxy.ts`, export `proxy` no `middleware` |
| Prisma | 7.x | `url` eliminado de `schema.prisma`; va en `prisma.config.ts`. Requiere driver adapter (`@prisma/adapter-pg`) |
| NextAuth | v5 beta | Split edge/node: `auth.config.ts` (edge-safe) + `auth.ts` (Node+Prisma) |
| shadcn/ui | 4.7.0 | Usa `@base-ui/react` en vez de Radix. **`asChild` NO existe**. Usar `buttonVariants()` + `<Link>` |

### Comandos de desarrollo (ejecutar desde la raíz del repo)

```bash
# Dev server web
npm run dev:web          # equivale a: cd apps/web && npm run dev

# Tests y tipos (desde raíz)
npm test --workspace=apps/web
cd apps/web && npx tsc --noEmit

# Base de datos (desde apps/web/)
cd apps/web
npx prisma migrate dev    # aplicar migraciones + generar cliente
npx prisma db seed        # cargar datos de prueba
npx prisma studio         # explorar la DB en el navegador

# O desde la raíz con workaround de path:
npm run -w apps/web prisma migrate dev
```

### Autenticación local (dev)

Credenciales fijas vía `apps/web/.env`:
- Email: `admin@dev.local`
- Password: `admin123`
- User ID fijo: `dev-local-user-001`

El usuario dev se crea automáticamente en la DB en el primer login (`events.signIn` en `auth.ts`).

### Arquitectura de archivos clave (apps/web)

```
apps/web/
├── src/
│   ├── app/
│   │   ├── (app)/          # Rutas protegidas (layout con navbar + guard de auth)
│   │   │   ├── dashboard/
│   │   │   └── trips/[id]/ # Secciones: flights, accommodations, activities,
│   │   │                   # expenses, packing, documents
│   │   └── auth/           # signin, error (rutas públicas)
│   ├── actions/            # Server Actions para CRUD. Todos hacen requireTripOwner()
│   ├── components/
│   │   ├── import/         # Wizard de importación vía IA
│   │   │   ├── ImportTrigger.tsx
│   │   │   ├── ImportWizard.tsx
│   │   │   ├── PromptStep.tsx
│   │   │   ├── UploadStep.tsx
│   │   │   └── ReviewStep.tsx
│   │   ├── layout/         # Navbar
│   │   ├── trips/          # Formularios de viaje
│   │   └── ui/             # shadcn/ui components
│   ├── lib/
│   │   ├── auth.config.ts  # Configuración NextAuth edge-safe (sin Prisma)
│   │   ├── auth.ts         # NextAuth completo con PrismaAdapter + dev credentials
│   │   ├── prisma.ts       # Singleton PrismaClient con PrismaPg adapter
│   │   └── schemas.ts      # Schemas Zod compartidos entre actions y tests
│   └── proxy.ts            # Next.js 16: reemplaza middleware.ts
├── prisma/
│   ├── schema.prisma       # Modelos: Trip, Flight, Accommodation, Activity, Expense, PackingItem, Document, Task
│   └── migrations/         # Historial de migraciones SQL
├── Dockerfile              # Build context = monorepo root; incluye packages/shared
└── Dockerfile.dev          # Dev con hot-reload

# Infraestructura (en la raíz del monorepo)
.github/workflows/
├── deploy-staging.yml      # Push a develop → build + push ghcr.io/.../tripplanner:staging
└── deploy-production.yml   # Push a main → build + push ghcr.io/.../tripplanner:latest
docker/
├── entrypoint.sh           # Prod: prisma migrate deploy + next start (WORKDIR=/app/apps/web)
└── entrypoint.dev.sh       # Dev: prisma generate + migrate + next dev
docker-compose.dev.yml      # Desarrollo local (context: monorepo root, dockerfile: apps/web/Dockerfile.dev)
docker-compose.prod.yml     # Producción: imagen :latest, puerto 3000
docker-compose.staging.yml  # Staging: imagen :staging, puerto 3001
```

### Patrones importantes (web)

#### Links con estilos de botón (shadcn 4.7)
```tsx
// CORRECTO — @base-ui no tiene asChild
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";
<Link href="/ruta" className={buttonVariants({ variant: "outline" })}>Texto</Link>

// INCORRECTO — no funciona en esta versión
<Button asChild><Link>...</Link></Button>
```

#### Select — onValueChange (shadcn 4.7 / @base-ui/react)
```tsx
// CORRECTO — @base-ui pasa string | null, hay que filtrar el null
<Select value={value} onValueChange={(v) => v !== null && setValue(v)}>

// INCORRECTO — falla en build: Dispatch<SetStateAction<string>> no acepta null
<Select value={value} onValueChange={setValue}>
```

#### Server Actions
```ts
// Todas las actions privadas siguen este patrón:
async function requireTripOwner(tripId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { userId: true } });
  if (!trip || trip.userId !== session.user.id) redirect("/trips");
}
```

#### Proxy (auth middleware) — Next.js 16
```ts
// src/proxy.ts — NO importar Prisma aquí (edge runtime)
export async function proxy(request: NextRequest) { return auth(request as any); }
export const config = { matcher: [...] };
```

#### redirect() en server actions — Next.js
`redirect()` lanza un error especial que los bloques `catch` capturan:
```ts
import { isRedirectError } from "next/dist/client/components/redirect-error";
try {
  await someAction(formData);
} catch (error) {
  if (isRedirectError(error)) throw error; // dejar pasar el redirect
  toast.error("Error");
}
```

#### Después de cualquier `prisma migrate dev`
Siempre ejecutar también `npx prisma generate` — la migración actualiza la DB pero no el cliente TypeScript.

### Entornos web

| Entorno | URL | Rama | Deploy |
|---|---|---|---|
| Local | `http://localhost:3000` | cualquiera | `npm run dev:web` |
| Staging | `https://staging.TU_DOMINIO` | `develop` | Automático al hacer push a `develop` |
| Producción | `https://TU_DOMINIO` | `main` | Automático vía Dockhand |

---

## ANDROID (`apps/android`)

### Stack

| Tecnología | Versión |
|---|---|
| Expo SDK | 54 |
| expo-router | 6.x (file-based routing, como Next.js) |
| expo-sqlite | 16.x (DB local; usa WebAssembly en web — solo Android) |
| react-native-reanimated | 4.x (babel plugin: `react-native-worklets/plugin`) |
| react-native-worklets | 0.5.x (nuevo en reanimated v4 — no el de reanimated v3) |
| NativeWind | 4.x (Tailwind para React Native) |
| React | 19.1.0 exacto (pinned — debe coincidir con react-native-renderer interno) |
| React Native | 0.81.5 |

**Nota crítica:** `react@19.1.0` está pinned exacto en el root `package.json` via `overrides` + dep directa. react-native@0.81.5 bundlea react-native-renderer@19.1.0 internamente — si la versión de React instalada difiere, la app arranca en negro sin error claro.

**Web no soportada:** expo-sqlite v16 usa `Atomics.wait()` en el hilo principal, bloqueado por W3C en navegadores. `src/db/database.web.ts` es un stub que no-op; `app/_layout.tsx` muestra un mensaje informativo en web. La app está diseñada para Android únicamente.

### Comandos

```bash
# Instalar dependencias de todo el monorepo (desde raíz)
npm install

# Dev server Android — ejecutar desde apps/android/
cd apps/android
npx expo start          # QR para Expo Go en el móvil
npx expo start --android  # abre emulador Android directamente

# Build para distribución (necesita cuenta EAS)
cd apps/android
npx eas build --platform android --profile production
npx eas build --platform android --profile preview   # APK para pruebas
```

### Arquitectura de archivos clave (apps/android)

```
apps/android/
├── app/                        # expo-router: rutas basadas en ficheros (como Next.js)
│   ├── _layout.tsx             # Root: inicializa SQLite + ProContext + SafeAreaProvider
│   ├── index.tsx               # Redirect → /trips
│   ├── settings.tsx            # Ajustes + toggle isPro (DEV) + botón "Actualizar a Pro"
│   └── trips/
│       ├── _layout.tsx         # Stack navigator para trips
│       ├── index.tsx           # Lista de viajes (con gate free/pro)
│       ├── new.tsx             # Formulario crear viaje
│       └── [id]/
│           ├── _layout.tsx     # Tabs con las 6 secciones del viaje
│           ├── index.tsx       # Vuelos (tab por defecto)
│           ├── accommodations.tsx
│           ├── activities.tsx
│           ├── expenses.tsx
│           ├── packing.tsx
│           └── documents.tsx
├── src/
│   ├── db/                     # Capa de datos SQLite (sin ORM, SQL directo)
│   │   ├── database.ts         # Inicialización + migraciones versionadas (PRAGMA user_version)
│   │   ├── trips.ts            # CRUD trips + countTrips()
│   │   ├── flights.ts          # CRUD vuelos + bulkCreateFlights()
│   │   ├── accommodations.ts   # CRUD alojamientos + bulk
│   │   ├── activities.ts       # CRUD actividades + bulk
│   │   ├── expenses.ts         # CRUD gastos + togglePaid() + sumExpenses()
│   │   ├── packing.ts          # CRUD maleta + togglePacked() + bulk
│   │   ├── documents.ts        # CRUD documentos + bulk
│   │   └── import.ts           # bulkImport() + checkDuplicates() — port del web action
│   ├── contexts/
│   │   └── ProContext.tsx      # isPro flag + FREE_TRIP_LIMIT = 1
│   └── components/
│       └── import/             # Wizard de importación IA (3 pasos)
│           ├── ImportWizard.tsx # Modal contenedor (step state + payload)
│           ├── PromptStep.tsx   # Paso 1: genera prompt + botón copiar portapapeles
│           ├── PasteStep.tsx    # Paso 2: pegar JSON + validar con Zod
│           └── ReviewStep.tsx   # Paso 3: preview checkboxes + detección duplicados + import
├── app.json                    # Config Expo (nombre, package, scheme, plugins)
├── babel.config.js             # NativeWind + JSX source
├── metro.config.js             # Monorepo support: watchFolders + nodeModulesPaths
├── tailwind.config.js          # Content paths para NativeWind
├── global.css                  # @tailwind base/components/utilities
└── tsconfig.json               # Extends expo/tsconfig.base + paths para @/ y @tripplanner/shared
```

### Modelo free/pro

- **Free:** máx. 1 viaje (controlado por `FREE_TRIP_LIMIT` en `ProContext.tsx`)
- **Pro:** viajes ilimitados
- **Activación:** `isPro` flag en `ProContext.tsx`
  - En DEV: toggle visible en `settings.tsx` (solo cuando `__DEV__ === true`)
  - En producción: TODO — integrar Google Play Billing (`expo-in-app-purchases`)
    1. Instalar `expo-in-app-purchases`
    2. Reemplazar el `useState(false)` en `ProContext.tsx` por verificación del estado de compra
    3. El resto de la app (gate en `trips/index.tsx`, botón en `settings.tsx`) no necesita cambios

### Base de datos SQLite (Android)

La DB se inicializa en `app/_layout.tsx` → `initDatabase()` (llamada una sola vez al arrancar).

**Migraciones**: sistema versionado con `PRAGMA user_version`:
```ts
// db/database.ts
const { user_version } = db.getFirstSync('PRAGMA user_version')!;
if (user_version < 1) {
  db.execSync(`CREATE TABLE IF NOT EXISTS trips (...); PRAGMA user_version = 1;`);
}
// Para añadir una nueva migración:
// if (user_version < 2) { db.execSync(`ALTER TABLE ...; PRAGMA user_version = 2;`); }
```

**Convención de columnas:** snake_case (`trip_id`, `start_date`, `flight_number`). Los tipos TypeScript usan el mismo snake_case para mantenerse alineados con SQLite.

### Import wizard (Android)

Mismo flujo que la web pero adaptado a móvil:
1. `PromptStep` genera el prompt con `generateImportPrompt()` del shared package y lo copia al portapapeles via `expo-clipboard`
2. El usuario pega en Claude/ChatGPT/Gemini y copia el JSON resultante
3. `PasteStep` valida con `importPayloadSchema.safeParse()` del shared package
4. `ReviewStep` detecta duplicados con `checkDuplicates()` de `src/db/import.ts` e importa con `bulkImport()`

`src/db/import.ts` es un port de `apps/web/src/actions/import.ts` — si se cambia el algoritmo de fuzzy matching, actualizar ambos.

---

## Cómo añadir una nueva sección (p.ej. "Transfers")

Afecta a ambas apps. Una sola rama/PR debería cubrir los 9 pasos:

### 1. Shared (`packages/shared/`)
- `import-schemas.ts` → añadir `importTransferSchema` y `ImportTransfer`
- `importPayloadSchema` → añadir `transfers: z.array(importTransferSchema).optional().default([])`
- `import-prompt.ts` → añadir el bloque de la sección al `SCHEMA:` del prompt

### 2. Web (`apps/web/`)
- `src/actions/import.ts` → añadir en `bulkImport()` (array tipado `Prisma.TransferCreateManyInput[]`) y en `checkDuplicates()`
- `prisma/schema.prisma` → nuevo modelo `Transfer` → `npx prisma migrate dev`
- Nueva ruta `src/app/(app)/trips/[id]/transfers/` → página web
- `src/components/import/ReviewStep.tsx` → añadir entrada en `SECTION_CONFIG` y case en `ItemSummary`
- `src/__tests__/import-schemas.test.ts` → añadir tests del nuevo schema

### 3. Android (`apps/android/`)
- `src/db/database.ts` → añadir tabla `transfers` en la siguiente versión de migración (incrementar `user_version`)
- `src/db/transfers.ts` → crear el CRUD + `bulkCreateTransfers()`
- `src/db/import.ts` → añadir en `bulkImport()` y `checkDuplicates()`
- `app/trips/[id]/transfers.tsx` → nueva pantalla con lista + botón "Importar vía IA"
- `app/trips/[id]/_layout.tsx` → añadir nuevo tab con icono
- `src/components/import/ReviewStep.tsx` → añadir en `SECTION_LABELS`, `SECTION_ICONS` e `itemLabel()`

---

## Workflow de desarrollo

### Estrategia de ramas

```
feat/nombre-N  ──PR──►  develop  ──PR──►  main
                              │                  │
                           staging            producción
                     (imagen :staging)    (imagen :latest)
                       auto-deploy        deploy manual
```

- Nunca trabajar directo en `develop` ni en `main` — branch protection activa.
- **Merge strategy: squash obligatorio.** Usar prefijo convencional en el título del PR (`feat:`, `fix:`, `refactor:`).

### Pasos para cada feature (web)

1. Crear issue en GitHub con labels
2. Crear rama desde `develop`: `feat/nombre-issue-N`
3. Implementar los cambios
4. `cd apps/web && npx tsc --noEmit` — sin errores de tipos
5. `npm test --workspace=apps/web` — 100 tests pasando
6. Probar visualmente en `http://localhost:3000`
7. Commit con prefijo convencional
8. PR hacia `develop` con `Closes #N`
9. Esperar CI (`Type check, tests y build`) — gate obligatorio
10. Merge → staging → revisar → PR develop→main → deploy vía Dockhand

**Project board:** https://github.com/users/aacienfuegos/projects/1

---

## Importación vía IA

### Decisiones de diseño (compartidas web y android)

**JSON en vez de CSV**: un único fichero cubre las 6 secciones heterogéneas. CSV requeriría 6 ficheros distintos o un formato ad-hoc que los LLMs generan de forma más inconsistente.

**Prompt en inglés**: los LLMs actuales siguen esquemas JSON con más precisión cuando las instrucciones están en inglés. Las fechas del viaje se incluyen en el prompt para que la IA resuelva años ambiguos ("15 de junio" → año correcto).

**Fuzzy matching para duplicados**: normaliza los strings (quita diacríticos, puntuación, espacios extra) y aplica Levenshtein con umbral 85% sobre palabras ordenadas alfabéticamente. Esto cubre "Hotel Marriott" ↔ "Marriott Hotel". Los números de vuelo usan exact match (`IB1234 ≠ IB1235`).

**Future-proofing (web)**: en `import.ts`, los arrays de `createMany` están tipados como `Prisma.XCreateManyInput[]`. Si se añade un campo no-nullable al schema de Prisma sin actualizar el wizard, `tsc --noEmit` falla antes de que el código llegue a producción.

### Archivos clave (web)

| Archivo | Propósito |
|---|---|
| `packages/shared/import-schemas.ts` | Zod schemas para las 6 secciones. **Fuente de verdad** |
| `packages/shared/import-prompt.ts` | Genera el prompt. `generateImportPrompt()` (manual) y `generateImportSystemPrompt()` / `generateImportUserMessage()` (AgentOS) |
| `apps/web/src/actions/import.ts` | `bulkImport` + `checkDuplicates` con Prisma |
| `apps/web/src/components/import/ReviewStep.tsx` | Paso 3: tabs por sección, checkboxes, badge "Duplicado" |

### Archivos clave (android)

| Archivo | Propósito |
|---|---|
| `packages/shared/import-schemas.ts` | Mismo — compartido con la web |
| `apps/android/src/db/import.ts` | `bulkImport` + `checkDuplicates` con SQLite (port del web) |
| `apps/android/src/components/import/PromptStep.tsx` | Copia prompt al portapapeles via expo-clipboard |
| `apps/android/src/components/import/PasteStep.tsx` | Pegar JSON + validar |
| `apps/android/src/components/import/ReviewStep.tsx` | Preview + checkboxes + import |
