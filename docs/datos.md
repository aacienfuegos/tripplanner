# Datos

Qué se guarda, de quién es y quién puede tocarlo. Los campos y enums no se copian: la fuente es
`apps/web/prisma/schema.prisma` para la web y `apps/android/src/db/database.ts` para Android.

## Web (PostgreSQL con Prisma)

### Modelos

Fuente: `apps/web/prisma/schema.prisma`. Los identificadores son cadenas `cuid()` salvo
`Settings` (fila única `global`) y las tablas de enlace de vídeos (clave compuesta).

| Grupo | Modelos | Relación con el usuario |
|---|---|---|
| Auth | `User`, `Account`, `Session`, `VerificationToken`, `Settings` | `Account` y `Session` cuelgan de `User`. `VerificationToken` (enlaces por email) no tiene relación. `Settings` es global, no de un usuario |
| Viajes | `Trip`; hijos `Destination`, `Flight`, `Accommodation`, `Activity`, `Document`, `Expense`, `Task`, `PackingItem` | `Trip` pertenece a un `User`; los hijos, a un `Trip` |
| Buceo | `DiveArea`, `DiveSite`, `DiveLog`, `DiveProfileSample`, `DiveEquipment`, `DiveEquipmentService`, `DiveCertification` | Todos llevan `userId` salvo `DiveProfileSample`, que cuelga de `DiveLog` |
| Vídeos | `MediaClip`, `MediaClipLink`, `MediaSiteOffset` | `MediaClip` y `MediaSiteOffset` llevan `userId`; `MediaClipLink` une un clip con una inmersión |

Relaciones entre modelos, a alto nivel:

- `DiveSite` puede pertenecer a una `DiveArea`; `DiveLog` puede estar en un `DiveSite` y vinculado
  a un `Trip`.
- `DiveLog` y `DiveEquipment` tienen una relación muchos a muchos implícita de Prisma (campo
  `equipment` en `DiveLog`, `diveLogs` en `DiveEquipment`).
- `DiveEquipmentService` es el historial de mantenimiento de un `DiveEquipment`.
- `MediaClipLink` solo guarda las correcciones manuales; los emparejamientos automáticos de clip e
  inmersión se calculan al leer (comentario del modelo en el esquema).
- `Trip`, `DiveSite`, `DiveLog` y `DiveCertification` tienen `externalId` único por usuario, para
  reimportar sin duplicar (`@@unique([userId, externalId])`).

### Borrados

Leídos de los `onDelete` del esquema:

- **En cascada.** Borrar un `User` borra sus `Account`, `Session`, `Trip`, `DiveArea`,
  `DiveSite`, `DiveLog`, `DiveEquipment`, `DiveEquipmentService`, `DiveCertification`,
  `MediaClip` y `MediaSiteOffset`. Borrar un `Trip` borra sus ocho modelos hijos. Borrar un
  `DiveLog` borra sus `DiveProfileSample` y `MediaClipLink`; borrar un `DiveEquipment`, su
  historial; borrar un `MediaClip`, sus `MediaClipLink`.
- **A nulo.** Borrar un `Trip` deja sus inmersiones sin viaje; borrar un `DiveSite`, sus
  inmersiones sin sitio; borrar una `DiveArea`, sus sitios sin área.

### Migraciones

En `apps/web/prisma/migrations/`. Se aplican al arrancar el contenedor con `prisma migrate
deploy` (`docker/entrypoint.sh`, descrito en `CLAUDE.md`). Para crearlas en local y regenerar el
cliente, ver `CLAUDE.md`.

## Android (SQLite local)

- Fichero `tripplanner.db` abierto con `expo-sqlite` en `apps/android/src/db/database.ts`, con
  `journal_mode = WAL` y `foreign_keys = ON`.
- Versión actual del esquema: **8** (`PRAGMA user_version`, última migración del mismo fichero).
  Las migraciones se encadenan por versión y una publicada no se edita (`CLAUDE.md`, "Base de
  datos SQLite").
- Columnas en snake_case y tipos TypeScript con los mismos nombres (`CLAUDE.md`). Identificadores
  enteros autoincrementales.
- Sin cuenta ni servidor: todo vive en el dispositivo. Algunos campos sensibles (documentos,
  referencias de reserva, notas) van cifrados con una clave guardada en el Keystore
  (`apps/android/src/crypto/fieldEncryption.ts`, usado por `flights.ts`, `accommodations.ts`,
  `activities.ts`, `documents.ts` e `import.ts` de `apps/android/src/db/`).
- Preferencias (tema e idioma) en AsyncStorage, no en SQLite
  (`apps/android/src/contexts/ThemeContext.tsx`, `apps/android/src/contexts/I18nContext.tsx`).

Correspondencia de tablas con los modelos web:

| Tabla Android | Modelo web | Versión |
|---|---|---|
| `trips` | `Trip` | 1 |
| `flights`, `accommodations`, `activities`, `expenses`, `packing_items`, `documents` | `Flight`, `Accommodation`, `Activity`, `Expense`, `PackingItem`, `Document` | 1 (coordenadas en 5) |
| `tasks` | `Task` | 2 |
| `dive_areas`, `dive_sites`, `dive_equipment`, `dive_equipment_service`, `dive_certifications`, `dive_logs` | `DiveArea`, `DiveSite`, `DiveEquipment`, `DiveEquipmentService`, `DiveCertification`, `DiveLog` | 3 (cambios en 4, 7 y 8) |
| `dive_log_equipment` | Relación implícita `DiveLog` y `DiveEquipment` | 3 |
| `dive_log_profile_samples` | `DiveProfileSample` | 4 (NDL en 6) |
| (no existe) | `Destination`, modelos de auth, `Settings`, `MediaClip`, `MediaClipLink`, `MediaSiteOffset` | |

Los borrados siguen la misma idea que en la web: cascada de `trips` a sus hijos y de `dive_logs`
a sus muestras y equipo enlazado, y a nulo de `dive_logs` hacia `trips` y `dive_sites`, y de
`dive_sites` hacia `dive_areas` (cláusulas `ON DELETE` de `apps/android/src/db/database.ts`).

## Autenticación (web)

### Proveedores

- Google y GitHub, cada uno solo si sus dos variables están definidas
  (`apps/web/src/lib/auth.config.ts`).
- Enlace por email con Resend, solo si `RESEND_API_KEY` está definida (`apps/web/src/lib/auth.ts`).
- Login de desarrollo (`dev-credentials`), solo si están definidas `DEV_ADMIN_EMAIL` y
  `DEV_ADMIN_PASSWORD` y además `NODE_ENV` no es `production` o `ALLOW_DEV_LOGIN` es `true`
  (`apps/web/src/lib/auth.ts`). Compara email y contraseña en tiempo constante
  (`apps/web/src/lib/timing-safe.ts`). Ese usuario se crea o actualiza como aprobado y
  administrador en cada inicio de sesión (`events.signIn`).
- Sesión JWT (`session.strategy` en `apps/web/src/lib/auth.ts`), con el adaptador de Prisma para
  usuarios y cuentas. Si la tabla `Session` llega a escribirse con esta estrategia: Pendiente de
  confirmar.

### Estados de usuario y alta

Estados `PENDING`, `APPROVED` y `DENIED` (enum `UserStatus`, por defecto `PENDING`). Al crearse un
usuario (`events.createUser` en `apps/web/src/lib/auth.ts`):

1. Si su email es el de `ADMIN_EMAIL`, queda aprobado y administrador.
2. Si no, y el registro está abierto (`Settings.registrationOpen`), queda aprobado.
3. Si no, queda pendiente y se avisa al administrador por email (si hay Resend y `ADMIN_EMAIL`).

Un usuario `DENIED` no puede iniciar sesión (`callbacks.signIn`). `PENDING` sí obtiene sesión, pero
el layout protegido lo manda a `/auth/pending`.

### Dónde se comprueba el acceso

- **Proxy** (`apps/web/src/proxy.ts` con `authorized` de `apps/web/src/lib/auth.config.ts`): exige
  sesión en todo salvo `/auth/*`; solo mira que haya sesión, no el estado. Su `matcher` deja fuera
  `/api`.
- **Layout protegido** (`apps/web/src/app/(app)/layout.tsx`): lee el usuario en la base de datos y
  redirige si no existe o está `DENIED`, si está `PENDING` o si no tiene nombre.
- **Páginas de un viaje** (`apps/web/src/app/(app)/trips/[tripId]/**/page.tsx`): comparan el
  `userId` del viaje con la sesión y devuelven 404 si no coincide.
- **Páginas de buceo** (`apps/web/src/app/(app)/dives/**/page.tsx`): llaman a `requireUser` y
  filtran por `userId`.
- **Server Actions** (`apps/web/src/actions/`):
  - `requireUser` (`apps/web/src/lib/action-auth.ts`) vuelve a leer el estado en la base de datos
    en cada petición, porque el JWT puede tener hasta 30 días; `DENIED` va a error y `PENDING` a
    `/auth/pending`.
  - `requireTripOwner` (mismo fichero) añade que el viaje sea del usuario; si no, redirige a
    `/trips`. La usan las acciones de las secciones del viaje y la importación.
  - Las acciones de buceo, perfil y viajes usan `requireUser` y filtran por `userId`.
  - `apps/web/src/actions/admin.ts` y `apps/web/src/actions/media.ts` tienen su propia comprobación:
    sesión y `isAdmin` en base de datos, sin mirar el estado.
  - `apps/web/src/actions/agentos.ts` (importación con IA) usa `requireUser`; no lee ningún viaje.
- **Rutas de API** (`apps/web/src/app/api/`):
  - `auth/[...nextauth]/route.ts`: los manejadores de NextAuth.
  - `dives/import/route.ts`: exige que `Origin` coincida con `Host` y llama a `requireUser`.
  - `health/route.ts`: no comprueba sesión; responde el estado de la base de datos.

### Administración

La página `apps/web/src/app/(app)/admin/page.tsx` y las acciones de `apps/web/src/actions/admin.ts`
exigen `isAdmin`. Permiten aprobar, denegar (no a un administrador), devolver a pendiente (no a un
administrador) y abrir o cerrar el registro (`Settings.registrationOpen`). No hay acción para
conceder o quitar `isAdmin`.
