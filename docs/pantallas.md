# Pantallas

Rutas de las dos apps, cómo se llega a cada una y qué se hace en ella. Sale de los ficheros de
rutas; las rutas web son relativas a `apps/web/src/app/` y las de Android a `apps/android/app/`.

## Web

### Navegación global

- Barra superior (`apps/web/src/components/layout/navbar.tsx`): logo a `/dashboard`, enlaces
  "Inicio" (`/dashboard`), "Mis viajes" (`/trips`) y "Buceo" (`/dives`), selector de idioma,
  selector de tema y menú de usuario con "Perfil" (`/profile`), "Panel de administración"
  (`/admin`, solo si `isAdmin`) y "Cerrar sesión". En móvil los tres enlaces pasan a una barra
  inferior fija (mismo fichero, `md:hidden`). Etiquetas en español de `apps/web/src/i18n/es.ts`.
- Navegación del viaje (`apps/web/src/components/trips/trip-nav.tsx`): botones "Vuelos",
  "Alojamiento", "Actividades" y "Gastos", y un desplegable "Más" con "Destinos", "Equipaje",
  "Documentos", "Tareas", "Buceo" y "Mapa". Cada sección la pinta debajo de una miga de pan
  Viajes > viaje > sección (`apps/web/src/components/layout/section-header.tsx`); la ficha del
  viaje la pinta directamente.

### Fuera del layout protegido

Estas rutas no pasan por el layout de `(app)`. Solo las de `/auth` son accesibles sin sesión: el
proxy la exige en todo lo demás (`apps/web/src/lib/auth.config.ts`, `authorized`).

| Ruta | Fichero | Qué hace |
|---|---|---|
| `/` | `page.tsx` | Redirige a `/dashboard` |
| `/auth/signin` | `auth/signin/page.tsx` | Botones de Google y GitHub, enlace por email y formulario de desarrollo, cada uno solo si está configurado |
| `/auth/pending` | `auth/pending/page.tsx` | Aviso de cuenta pendiente de aprobación y botón de cerrar sesión; si el usuario ya está aprobado va a `/dashboard`, si está denegado a `/auth/error` |
| `/auth/error` | `auth/error/page.tsx` | Mensaje según el parámetro `error` y enlace a `/auth/signin` |
| `/onboarding` | `onboarding/page.tsx` | Pide nombre e imagen la primera vez; exige sesión y, si ya hay nombre, va a `/dashboard` |

### Protegidas (`(app)`)

El layout `apps/web/src/app/(app)/layout.tsx` redirige antes de pintar nada: sin sesión a
`/auth/signin`, usuario inexistente o `DENIED` a `/auth/error?error=AccessDenied`, `PENDING` a
`/auth/pending` y sin nombre a `/onboarding`.

| Ruta | Fichero bajo `(app)/` | Desde dónde se llega | Acción principal |
|---|---|---|---|
| `/dashboard` | `dashboard/page.tsx` | Barra, logo | Ver el viaje en curso o el próximo, próximos vuelos y alojamientos; crear viaje |
| `/trips` | `trips/page.tsx` | Barra | Listar viajes; crear viaje |
| `/trips/new` | `trips/new/page.tsx` | Botón de `/trips` y `/dashboard` | Crear viaje |
| `/trips/[tripId]` | `trips/[tripId]/page.tsx` | Lista de viajes, panel de inicio, miga de pan | Ver cabecera, cuenta atrás, resumen y cronología; importar con IA; ir a editar |
| `/trips/[tripId]/edit` | `trips/[tripId]/edit/page.tsx` | Botón Editar de la ficha | Editar el viaje |
| `/trips/[tripId]/flights` | `trips/[tripId]/flights/page.tsx` | Navegación del viaje | CRUD de vuelos |
| `/trips/[tripId]/accommodations` | `trips/[tripId]/accommodations/page.tsx` | Navegación del viaje | CRUD de alojamientos |
| `/trips/[tripId]/activities` | `trips/[tripId]/activities/page.tsx` | Navegación del viaje | CRUD de actividades |
| `/trips/[tripId]/expenses` | `trips/[tripId]/expenses/page.tsx` | Navegación del viaje | CRUD de gastos |
| `/trips/[tripId]/destinations` | `trips/[tripId]/destinations/page.tsx` | "Más", destinos de la cabecera de la ficha | CRUD de destinos |
| `/trips/[tripId]/packing` | `trips/[tripId]/packing/page.tsx` | "Más" | Lista de maleta |
| `/trips/[tripId]/documents` | `trips/[tripId]/documents/page.tsx` | "Más" | CRUD de documentos |
| `/trips/[tripId]/tasks` | `trips/[tripId]/tasks/page.tsx` | "Más" | Tareas y reservas pendientes |
| `/trips/[tripId]/dives` | `trips/[tripId]/dives/page.tsx` | "Más" | Vincular y desvincular inmersiones del viaje |
| `/trips/[tripId]/map` | `trips/[tripId]/map/page.tsx` | "Más" | Mapa de los elementos del viaje |
| `/dives` | `dives/page.tsx` | Barra | Pestañas "Registro", "Puntos de inmersión", "Equipo", "Certificaciones", "Estadísticas" y "Media" (esta, solo para el administrador con biblioteca configurada); la pestaña se elige con `?tab=`; importar de Diving Log desde el registro (`apps/web/src/components/dives/dive-log-list.tsx`) |
| `/dives/[id]` | `dives/[id]/page.tsx` | Pestaña Registro | Ficha de la inmersión con perfil, datos técnicos y vídeos; editar o borrar |
| `/dives/sites/[id]` | `dives/sites/[id]/page.tsx` | Pestaña Puntos de inmersión y su mapa | Ficha del sitio; editar o borrar |
| `/dives/sites/areas/[id]` | `dives/sites/areas/[id]/page.tsx` | Pestaña Puntos de inmersión (`apps/web/src/components/dives/dive-site-list.tsx`) | Ficha del área; editar o borrar |
| `/dives/equipment/[id]` | `dives/equipment/[id]/page.tsx` | Pestaña Equipo | Ficha del equipo y su mantenimiento |
| `/profile` | `profile/page.tsx` | Menú de usuario | Editar nombre, imagen y unidades |
| `/admin` | `admin/page.tsx` | Menú de usuario, solo administrador | Aprobar, denegar o revocar usuarios; abrir o cerrar el registro. Si no eres administrador, redirige a `/dashboard` |

Las secciones de un viaje ajeno o inexistente devuelven 404 (`notFound()` en cada `page.tsx` de
`trips/[tripId]/`).

### Rutas de API

| Ruta | Fichero | Qué hace |
|---|---|---|
| `/api/auth/[...nextauth]` | `api/auth/[...nextauth]/route.ts` | Endpoints de NextAuth |
| `/api/dives/import` | `api/dives/import/route.ts` | `POST` del fichero de Diving Log; devuelve el contenido parseado para revisarlo |
| `/api/health` | `api/health/route.ts` | Estado de la conexión a la base de datos |

### Formularios, borrado y estados

- Formularios: los de cada sección se abren en un diálogo (`apps/web/src/components/ui/dialog.tsx`,
  usado en los `*-list.tsx` de `apps/web/src/components/`); crear y editar viaje, perfil y
  onboarding son páginas.
- Borrado: confirmación con `useConfirmDialog` (`apps/web/src/components/ui/confirm-dialog.tsx`).
  El viaje no se puede borrar desde ninguna pantalla: la acción `deleteTrip` de
  `apps/web/src/actions/trips.ts` no se invoca en la interfaz.
- Avisos: toasts de `sonner` (`apps/web/src/components/ui/sonner.tsx`).
- Vacío: cada lista pinta su propio mensaje cuando no hay elementos; no hay un componente común.
- Carga: `apps/web/src/components/ui/skeleton.tsx` solo se usa mientras cargan los mapas
  (`apps/web/src/components/map/TripMapView.tsx`, `apps/web/src/components/dives/DiveSitesMapView.tsx`).
  No hay ficheros `loading.tsx`.
- Error: no hay `error.tsx` ni `not-found.tsx` propios; se usan los de Next.js.

## Android

### Entrada y módulos

- `index.tsx` redirige a `/dives` en la variante `dive-public` y a `/trips` en el resto
  (`apps/android/app/index.tsx`).
- El título de la cabecera de viajes y de buceo es un selector de módulo que cambia entre los dos
  con `router.replace` (`apps/android/src/components/ModuleSwitcherHeader.tsx`).
- Ajustes (`settings.tsx`) solo tiene acceso desde el icono de la cabecera de la lista de viajes
  (`apps/android/app/trips/_layout.tsx`); desde el módulo de buceo hay que cambiar antes a viajes.

### Viajes

| Ruta | Fichero | Qué hace |
|---|---|---|
| `/trips` | `trips/index.tsx` | Lista de viajes; crear (bloqueado por el límite gratuito); borrar con alerta de confirmación |
| `/trips/new` | `trips/new.tsx` | Crear viaje, presentado como modal |
| `/trips/[id]` | `trips/[id]/index.tsx` | Pestaña "Inicio" (resumen del viaje); botones a mapa y edición |
| `/trips/[id]/flights`, `accommodations`, `activities` | `trips/[id]/*.tsx` | Pestañas inferiores del viaje |
| `/trips/[id]/expenses`, `packing`, `documents`, `tasks`, `dives` | `trips/[id]/*.tsx` | Hoja "Más secciones" que abre la quinta pestaña |
| `/trips/[id]/map` | `trips/[id]/map.tsx` | Desde el resumen, la cabecera de las secciones y la pestaña de inmersiones |
| `/trips/[id]/edit` | `trips/[id]/edit.tsx` | Desde el resumen y la cabecera de las secciones |

Las pestañas se definen en `apps/android/app/trips/[id]/_layout.tsx`: "Inicio", "Vuelos",
"Alojam.", "Actividades" y "Más". `more.tsx` no se pinta nunca: el botón abre una hoja modal con
las secciones restantes. Si el viaje está bloqueado por el límite gratuito, se muestra una franja
de aviso y las acciones de edición abren una alerta
(`apps/android/src/contexts/TripLockContext.tsx`).

En cada sección: botón flotante de alta (`apps/android/src/components/SectionFAB.tsx`), iconos de
mapa, importación y edición en la cabecera (`apps/android/src/components/SectionHeaderRight.tsx`)
y formularios como modales `Modal` con `presentationStyle="pageSheet"`
(`apps/android/src/components/forms/*FormModal.tsx`, los 13). La importación
con IA es un asistente de tres pasos, Prompt, Pegar y Revisar
(`apps/android/src/components/import/ImportWizard.tsx`), disponible en vuelos, alojamientos,
actividades, gastos, maleta, documentos y tareas.

### Buceo

Pestañas inferiores en `apps/android/app/dives/_layout.tsx`: "Registro" (`dives/index.tsx`),
"Puntos" (`dives/sites.tsx`), "Equipo" (`dives/equipment.tsx`), "Certificaciones"
(`dives/certifications.tsx`) y "Estadísticas" (`dives/stats.tsx`). Etiquetas de
`apps/android/src/i18n/es.ts`. Las fichas `dive-detail.tsx`,
`site-detail.tsx` y `equipment-detail.tsx` son rutas ocultas de ese mismo navegador y reciben el
`id` por parámetro de consulta (`?id=`).

### Ajustes

`settings.tsx`: plan gratuito o Pro con botón "Actualizar a Pro" (aviso de próximamente),
apariencia, idioma, interruptor para simular Pro solo en desarrollo e información de versión.

### Estados

- Arranque: pantalla vacía con el color de fondo mientras se inicializa la base de datos
  (`apps/android/app/_layout.tsx`).
- Vacío, carga y error: no hay un patrón común; cada pantalla resuelve el suyo.
- Borrado: `Alert.alert` con confirmación (por ejemplo, `apps/android/app/trips/index.tsx`).

## Diferencias

- La web tiene destinos, vídeos de inmersión, importación de Diving Log, importación vía AgentOS,
  perfil, administración y pantallas de autenticación; Android no.
- Android tiene ajustes con plan gratuito o Pro y bloqueo de viajes; la web no tiene límites.
- Android permite borrar un viaje desde la lista; la web no tiene esa acción en la interfaz.
- Navegación del viaje: en la web, cuatro secciones más un desplegable "Más" en la cabecera; en
  Android, pestañas inferiores con un resumen ("Inicio") y una hoja "Más". El mapa está en "Más" en la web y en
  iconos de cabecera en Android.
- Buceo: en la web, una página con pestañas por parámetro y fichas en rutas propias con `[id]`; en
  Android, pestañas de navegación y fichas con `?id=`.
- Formularios: diálogos en la web, modales en hoja en Android.
