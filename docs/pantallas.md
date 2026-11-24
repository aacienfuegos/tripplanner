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
| `/oauth/authorize` | `oauth/authorize/page.tsx` | Consentimiento de un agente: dominio del cliente y de la vuelta (con aviso si es `localhost`), nombre de la conexión, viajes (todos o los elegidos), buceo y permisos; "Autorizar" vuelve al cliente con el código y "Cancelar" con `access_denied`. Si la petición falla después de comprobar el cliente y su dirección de vuelta, un cliente registrado a mano vuelve solo con el error; uno con documento CIMD ve el error y un enlace "Volver a <host>", porque cualquiera puede publicar uno con su propia dirección (RFC 9700, 4.11.2). Estados: petición inválida, cuenta no aprobada, demasiadas peticiones, límite de 10 conexiones (enlace a `/profile/agents`) y servidor sin configurar. Tarjeta `max-w-lg`; exige sesión (el proxy vuelve aquí tras iniciar sesión) |

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
| `/trips/[tripId]/accommodations` | `trips/[tripId]/accommodations/page.tsx` | Navegación del viaje | CRUD de alojamientos; encima, "Sugerencias de agentes" si hay pendientes |
| `/trips/[tripId]/activities` | `trips/[tripId]/activities/page.tsx` | Navegación del viaje | CRUD de actividades; encima, "Sugerencias de agentes" si hay pendientes |
| `/trips/[tripId]/expenses` | `trips/[tripId]/expenses/page.tsx` | Navegación del viaje | CRUD de gastos |
| `/trips/[tripId]/destinations` | `trips/[tripId]/destinations/page.tsx` | "Más", destinos de la cabecera de la ficha | CRUD de destinos |
| `/trips/[tripId]/packing` | `trips/[tripId]/packing/page.tsx` | "Más" | Equipaje en dos vistas, "Por categoría" y "Por maleta" (recordada en la cookie `packingView`), con búsqueda y "Solo lo que falta por meter"; crear objetos en línea y editarlos en un diálogo; crear, editar, borrar (sacando o borrando sus objetos), desmarcar y compartir maletas; modo de selección con barra fija abajo (mover a una maleta, marcar, desmarcar, borrar); diálogos de maleta de destino y de copiar de otro viaje (`apps/web/src/components/packing/`) |
| `/trips/[tripId]/documents` | `trips/[tripId]/documents/page.tsx` | "Más" | CRUD de documentos |
| `/trips/[tripId]/tasks` | `trips/[tripId]/tasks/page.tsx` | "Más" | Tareas y reservas pendientes |
| `/trips/[tripId]/dives` | `trips/[tripId]/dives/page.tsx` | "Más" | Vincular y desvincular inmersiones del viaje |
| `/trips/[tripId]/map` | `trips/[tripId]/map/page.tsx` | "Más" | Mapa de los elementos del viaje |
| `/dives` | `dives/page.tsx` | Barra | Pestañas "Registro", "Puntos de inmersión", "Equipo", "Certificaciones", "Estadísticas" y "Media" (esta, solo para el administrador con biblioteca configurada); la pestaña se elige con `?tab=`; importar de Diving Log desde el registro (`apps/web/src/components/dives/dive-log-list.tsx`) |
| `/dives/[id]` | `dives/[id]/page.tsx` | Pestaña Registro | Ficha de la inmersión con perfil, datos técnicos y vídeos; editar o borrar |
| `/dives/sites/[id]` | `dives/sites/[id]/page.tsx` | Pestaña Puntos de inmersión y su mapa | Ficha del sitio; editar o borrar |
| `/dives/sites/areas/[id]` | `dives/sites/areas/[id]/page.tsx` | Pestaña Puntos de inmersión (`apps/web/src/components/dives/dive-site-list.tsx`) | Ficha del área; editar o borrar |
| `/dives/equipment/[id]` | `dives/equipment/[id]/page.tsx` | Pestaña Equipo | Ficha del equipo y su mantenimiento |
| `/profile` | `profile/page.tsx` | Menú de usuario | Editar nombre, imagen y unidades; tarjeta "Conexiones de agentes" con las activas y enlace a `/profile/agents` |
| `/profile/agents` | `profile/agents/page.tsx` | Tarjeta del perfil, error de límite del consentimiento | Dirección del servidor MCP; pestaña "Conexiones" (revocar, con confirmación), "Clientes" (registrar en un diálogo, copiar `client_id`, borrar con confirmación que dice cuántas conexiones se revocan) y "Registro" (lo creado, editado, borrado y sugerido por los agentes en los últimos 90 días, lo más reciente primero, 50 por página, filtrable por conexión; en las ediciones, cada campo con su valor de antes y de después; en los borrados, el nombre del elemento y "Restaurar", con un toast al terminar, o "Restaurado el <fecha>"). La pestaña se elige con `?tab=`, y el filtro y la página con `?grant=` y `?page=` (`apps/web/src/components/agents/`) |
| `/admin` | `admin/page.tsx` | Menú de usuario, solo administrador | Aprobar, denegar o revocar usuarios; abrir o cerrar el registro. Si no eres administrador, redirige a `/dashboard` |

Las secciones de un viaje ajeno o inexistente devuelven 404 (`notFound()` en cada `page.tsx` de
`trips/[tripId]/`).

Lo que creó o editó un agente lleva junto a su nombre, en las listas y en las fichas, la marca
"Añadido por" o "Editado por" con el nombre de la conexión
(`apps/web/src/components/agents/agent-badge.tsx`): en la lista de viajes y su ficha, en las ocho
secciones del viaje y sus inmersiones, y en el registro, los sitios, las zonas, el equipo, su
mantenimiento y las certificaciones de `/dives`. Editarlo desde la web la quita.

En alojamientos y actividades del viaje, el bloque "Sugerencias de agentes"
(`apps/web/src/components/agents/agent-suggestions.tsx`) sale encima de la lista solo si hay
sugerencias pendientes de ese tipo. Cada tarjeta trae los datos de la sugerencia, quién la hizo y
"Aceptar" y "Descartar", con un toast de `sonner` al terminar. Aceptarla la convierte en un
alojamiento o una actividad de la lista, con la marca "Añadido por"; descartarla la quita del
bloque. Enseña las 20 más antiguas y, si hay más, una línea que lo dice: salen al resolver
estas. Las sugerencias no salen en el mapa, la cronología, los gastos, el panel ni los contadores
de la navegación del viaje.

### Rutas de API

| Ruta | Fichero | Qué hace |
|---|---|---|
| `/api/auth/[...nextauth]` | `api/auth/[...nextauth]/route.ts` | Endpoints de NextAuth |
| `/api/dives/import` | `api/dives/import/route.ts` | `POST` del fichero de Diving Log; devuelve el contenido parseado para revisarlo |
| `/api/health` | `api/health/route.ts` | Estado de la conexión a la base de datos |
| `/api/oauth/token` | `api/oauth/token/route.ts` | `POST` de formulario: canje del código (con PKCE) y refresco; responde los tokens o un error RFC 6749 |
| `/api/oauth/revoke` | `api/oauth/revoke/route.ts` | `POST` de formulario (RFC 7009): revoca un token; siempre 200, salvo 429 pasadas 20 por minuto e IP |
| `/.well-known/oauth-authorization-server` | `.well-known/oauth-authorization-server/route.ts` | Metadatos del servidor de autorización (RFC 8414) |
| `/.well-known/oauth-protected-resource` y `…/api/mcp` | `.well-known/oauth-protected-resource/route.ts` y `.well-known/oauth-protected-resource/api/mcp/route.ts` | Metadatos del recurso protegido (RFC 9728) |
| `/api/mcp` | `api/mcp/route.ts` | Servidor MCP de los agentes: `POST` con token bearer; `GET` y `DELETE`, 405 (`docs/tecnico.md`, "Servidor MCP") |

Las rutas de OAuth y `/api/mcp` responden 503 si `AUTH_URL` no es una URL `https` (`docs/tecnico.md`).

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
(`apps/android/src/components/forms/*FormModal.tsx`, los 14). La importación
con IA es un asistente de tres pasos, Prompt, Pegar y Revisar
(`apps/android/src/components/import/ImportWizard.tsx`), disponible en vuelos, alojamientos,
actividades, gastos, maleta, documentos y tareas.

Maleta (`trips/[id]/packing.tsx`, con sus trozos en `apps/android/src/components/packing/`): en
la cabecera de la lista, el progreso total, la búsqueda (sin distinguir mayúsculas ni tildes), el
selector "Por categoría / Por maleta" (recordado en AsyncStorage, `@tripplanner/packing-view`), el
interruptor "Solo lo que falta por meter" (se quita al volver a la sección) y una fila de acciones:
"Nueva maleta", "Lista predeterminada" (solo con la lista vacía), "Copiar de otro viaje" (si hay
viajes con algo que copiar), "Seleccionar" y "Desmarcar todo". En "Por categoría", cada objeto
muestra su maleta; en "Por maleta", una sección por maleta con tipo, peso, progreso e iconos de
editar, desmarcar todo, compartir (`Share.share`) y borrar, y al final "Sin maleta". Las opciones
de la maleta son iconos y no un `Alert` porque Android pinta como mucho tres botones en un
`Alert`. Borrar una maleta con objetos pregunta con "Cancelar", "Sacarlos de la maleta" y
"Borrarlos también". Con "Seleccionar", tocar un objeto lo selecciona y el botón flotante deja
sitio a una barra con "Seleccionar todo", "Mover a una maleta", "Marcar como metidos",
"Desmarcar", "Borrar" y "Salir". Elegir la maleta de destino y copiar de otro viaje son modales en
hoja. El formulario de objeto lleva una fila de maleta y el de maleta, nombre, tipo y peso en la
unidad de Ajustes.

### Buceo

Pestañas inferiores en `apps/android/app/dives/_layout.tsx`: "Registro" (`dives/index.tsx`),
"Puntos" (`dives/sites.tsx`), "Equipo" (`dives/equipment.tsx`), "Certificaciones"
(`dives/certifications.tsx`) y "Estadísticas" (`dives/stats.tsx`). Etiquetas de
`apps/android/src/i18n/es.ts`. Las fichas `dive-detail.tsx`,
`site-detail.tsx` y `equipment-detail.tsx` son rutas ocultas de ese mismo navegador y reciben el
`id` por parámetro de consulta (`?id=`).

### Ajustes

`settings.tsx`: plan gratuito o Pro con botón "Actualizar a Pro" (aviso de próximamente),
apariencia, idioma, sistema de unidades (métrico o imperial, para el peso de las maletas),
interruptor para simular Pro solo en desarrollo e información de versión.

### Estados

- Arranque: pantalla vacía con el color de fondo mientras se inicializa la base de datos
  (`apps/android/app/_layout.tsx`).
- Vacío, carga y error: no hay un patrón común; cada pantalla resuelve el suyo.
- Borrado: `Alert.alert` con confirmación (por ejemplo, `apps/android/app/trips/index.tsx`).

## Diferencias

- La web tiene destinos, vídeos de inmersión, importación de Diving Log, perfil, administración y
  pantallas de autenticación; Android no.
- Android tiene ajustes con plan gratuito o Pro y bloqueo de viajes; la web no tiene límites.
- Android permite borrar un viaje desde la lista; la web no tiene esa acción en la interfaz.
- Navegación del viaje: en la web, cuatro secciones más un desplegable "Más" en la cabecera; en
  Android, pestañas inferiores con un resumen ("Inicio") y una hoja "Más". El mapa está en "Más" en la web y en
  iconos de cabecera en Android.
- Buceo: en la web, una página con pestañas por parámetro y fichas en rutas propias con `[id]`; en
  Android, pestañas de navegación y fichas con `?id=`.
- Formularios: diálogos en la web, modales en hoja en Android.
