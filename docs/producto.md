# Producto

Describe TripPlanner tal como está en `develop`. Cada afirmación lleva la ruta de donde sale; lo
que no está en el código va marcado como "Pendiente de confirmar". Un plan nuevo dice qué cambia
de este documento, no lo vuelve a describir.

Documentos hermanos: `docs/tecnico.md`, `docs/pantallas.md`, `docs/diseno.md`, `docs/datos.md`.

## Qué es

Planificador de viajes con un módulo de buceo, en dos aplicaciones que comparten la lógica de
importación con IA (`CLAUDE.md`, cabecera):

- **Web** (`apps/web`): multiusuario, con cuenta. El alta la aprueba un administrador salvo que el
  registro esté abierto (`apps/web/src/lib/auth.ts`, `events.createUser`). La descripción de la
  app es "Organiza tus viajes: vuelos, hoteles, actividades y más"
  (`apps/web/src/app/layout.tsx`, `metadata`).
- **Android** (`apps/android`): datos locales en SQLite, sin cuenta ni servidor, con un límite de
  viajes en la versión gratuita (`CLAUDE.md`, sección ANDROID; `apps/android/src/lib/pro-limits.ts`).

## Para quién

- Web: usuarios aprobados y un administrador. El administrador es la cuenta cuyo email coincide con
  la variable `ADMIN_EMAIL` (`apps/web/src/lib/auth.ts`, `events.createUser`); también se puede
  marcar como administrador a otros usuarios en la base de datos (campo `isAdmin`,
  `apps/web/prisma/schema.prisma`, modelo `User`). No hay pantalla para conceder ese permiso
  (`apps/web/src/actions/admin.ts` no lo hace).
- Android: tres variantes de la misma base de código (`apps/android/app.config.ts`, tabla de
  variantes en `CLAUDE.md`): `full` (TripPlanner, arranca en viajes) con y sin sync, y
  `dive-public` ("Sub", arranca en buceo, `apps/android/app/index.tsx`).
- Público objetivo de cada variante (perfil de usuario, mercado): Pendiente de confirmar. No está
  escrito en el repo.

## Funcionalidades que existen hoy

### Viajes (web)

Fuente: `apps/web/src/app/(app)/trips/` y `apps/web/src/actions/`.

- Crear, editar y listar viajes (`apps/web/src/actions/trips.ts`). La acción `deleteTrip` existe,
  pero ninguna pantalla la invoca (búsqueda de `deleteTrip` en `apps/web/src`: solo la acción, los
  tests y las cadenas de i18n).
- Ficha del viaje con cabecera, cuenta atrás, resumen y cronología por días
  (`apps/web/src/app/(app)/trips/[tripId]/page.tsx`).
- Secciones del viaje, cada una en su ruta bajo `apps/web/src/app/(app)/trips/[tripId]/`:
  vuelos (`flights`), alojamientos (`accommodations`), actividades (`activities`), gastos
  (`expenses`, con conversión a la moneda del viaje vía `apps/web/src/lib/exchangeRate.ts`),
  destinos (`destinations`), maleta (`packing`), documentos (`documents`), tareas (`tasks`, con
  las reservas pendientes de `apps/web/src/components/tasks/pending-bookings.tsx`), inmersiones
  vinculadas al viaje (`dives`) y mapa (`map`).
- Equipaje con maletas (`apps/web/src/components/packing/`, acciones en
  `apps/web/src/actions/packing.ts` y `suitcases.ts`): cada maleta tiene nombre, tipo (cabina,
  facturada, mochila u otro) y peso opcional, y cada objeto va en una maleta o en "Sin maleta". Dos
  vistas, por categoría y por maleta, con el progreso de cada maleta; la vista elegida se recuerda
  en la cookie `packingView`. Los objetos se crean, se editan (nombre, categoría, cantidad y maleta;
  al cambiar de maleta se desmarcan) y se tachan al meterlos. Hay búsqueda sin distinguir
  mayúsculas ni tildes, filtro de lo que falta por meter, selección múltiple (mover, marcar,
  desmarcar y borrar), "Desmarcar todo" de una maleta o de la sección, copiar las maletas y los
  objetos de otro viaje del usuario y compartir una maleta como texto en el portapapeles. Al borrar
  una maleta con objetos se eligen sacarlos de la maleta o borrarlos también. La lista
  predeterminada y el equipo de buceo preguntan a qué maleta van si el viaje tiene alguna.
- Panel de inicio con el viaje en curso o el próximo y los próximos vuelos y alojamientos
  (`apps/web/src/app/(app)/dashboard/page.tsx`).

### Importación con IA (web)

- Modo manual en tres pasos: la app genera un prompt, el usuario lo pega en la IA que quiera y
  sube o pega el JSON resultante, que se revisa antes de importar
  (`apps/web/src/components/import/ImportWizard.tsx`, `PromptStep.tsx`, `UploadStep.tsx`,
  `ReviewStep.tsx`; prompt en `packages/shared/import-prompt.ts`).
- Detección de duplicados y alta en bloque (`apps/web/src/actions/import.ts`).
- Los objetos de equipaje pueden traer el nombre de su maleta (campo `suitcase`). Si el viaje ya
  tiene una maleta con ese nombre, sin distinguir mayúsculas ni tildes, van a ella; si no, se crea
  una, de tipo Otro y sin peso, una sola por nombre. Sin el campo, como antes: quedan sin maleta.

### Buceo (web)

Fuente: `apps/web/src/app/(app)/dives/` y `apps/web/src/actions/dive*.ts`.

- Inmersiones con ficha, perfil de profundidad y estadísticas técnicas
  (`apps/web/src/app/(app)/dives/[id]/page.tsx`).
- Sitios de buceo agrupados en áreas (`dives/sites/[id]`, `dives/sites/areas/[id]`).
- Equipo con historial de mantenimiento (`dives/equipment/[id]`,
  `apps/web/src/actions/dive-equipment.ts`).
- Certificaciones y estadísticas (pestañas de `apps/web/src/app/(app)/dives/page.tsx`).
- Importación del logbook de Diving Log (fichero SQLite) por
  `apps/web/src/app/api/dives/import/route.ts` y `apps/web/src/actions/dive-import.ts`.
- Vídeos y fotos de la inmersión: biblioteca indexada desde el servidor, enlazada con Jellyfin.
  Solo la ve el administrador y solo si la biblioteca está configurada
  (`apps/web/src/lib/dive-media.ts`, `mediaConfigFor`; `apps/web/src/actions/media.ts`).

### Cuenta y administración (web)

- Inicio de sesión, alta, estados de usuario y panel de administración: ver `docs/datos.md`,
  sección "Autenticación".
- Perfil: nombre, imagen y sistema de unidades métrico o imperial
  (`apps/web/src/components/profile/profile-form.tsx`). El sistema de unidades se aplica al peso de
  las maletas: se escribe y se ve en kg o en lb, y se guarda en gramos, así que cambiarlo no cambia
  el peso guardado (`packages/shared/packing.ts`). El idioma y el tema no están en el perfil:
  se cambian desde la barra de navegación (`apps/web/src/components/layout/navbar.tsx`).
- Conexiones de agentes (`/profile/agents`): un usuario aprobado autoriza a un agente de IA a
  usar su cuenta por MCP desde una pantalla de consentimiento, eligiendo nombre, viajes (todos o
  algunos), buceo (sin acceso, lectura, o lectura y escritura) y permisos (sugerir, escribir y
  borrar, desmarcados por defecto). Cada autorización es una conexión que se ve en el perfil con
  todo menos los tokens y se puede revocar. Si el agente no publica un documento de metadatos
  (CIMD), se registra antes como cliente (como mucho 5); borrar un cliente revoca sus
  conexiones. Como mucho 10 conexiones activas, y una conexión caduca a los 90 días sin uso. La
  pestaña Registro muestra, por conexión, lo que han creado, editado, borrado y sugerido los
  agentes en los últimos 90 días, con el valor de antes y el de después de cada campo editado. Lo
  borrado trae su nombre y "Restaurar", que lo vuelve a crear con los mismos datos; si el viaje o
  el equipo al que pertenecía ya no existe, no se restaura y lo dice.

### Acceso de agentes (MCP)

Un agente con una conexión usa la cuenta por el servidor MCP de `/api/mcp`
(`apps/web/src/lib/mcp/`), solo dentro de lo que se concedió: los viajes elegidos (o todos, también
los que se creen después) y los permisos marcados.

- Leer viajes: la lista y la ficha de cada viaje con todas sus secciones y el resumen de sus
  inmersiones (fecha, sitio, profundidad y tiempo).
- Escribir en un viaje: crear y editar destinos, vuelos, alojamientos, actividades, documentos,
  gastos, tareas y objetos del equipaje, con los mismos efectos que desde la web (el punto en el
  mapa, la conversión de moneda, el orden de los destinos). El equipaje se crea sin maleta y su
  edición no cambia la maleta. Crear un viaje o editar sus datos solo con una conexión a todos los
  viajes.
- Leer el buceo: inmersiones (con filtro por viaje y por fechas), perfil, sitios y zonas, equipo
  con su mantenimiento, certificaciones y estadísticas; los vídeos, solo el administrador con
  biblioteca.
- Escribir en el buceo: registrar y editar inmersiones, vincularlas a un viaje de la conexión o
  desvincularlas, sitios, zonas, equipo, mantenimientos y certificaciones, y para el
  administrador, qué vídeos van con una inmersión. De un viaje fuera de la conexión, una inmersión
  solo enseña su identificador, y no se puede mover de ahí.
- Al crear algo igual a lo que ya hay, no se crea y el agente recibe el existente; puede repetirlo
  indicando que lo cree igualmente.
- Borrar, con su permiso aparte en viajes y en buceo: un elemento cada vez, como mucho 20 por
  conexión en 24 horas, y todo se puede restaurar desde el registro durante 90 días. En el buceo no
  se borra un sitio con inmersiones, una zona con sitios ni un equipo usado en una inmersión o con
  mantenimiento: el agente recibe qué tiene vinculado. No hay forma de borrar un viaje ni una
  inmersión.
- Sugerir alojamientos y actividades sin añadirlos: esperan en el bloque "Sugerencias de agentes"
  de su pantalla en el viaje, fuera del mapa, la cronología y los gastos, hasta que el usuario las
  acepta (pasan a ser un alojamiento o una actividad normal, con su punto en el mapa y la marca
  "Añadido por") o las descarta. El agente ve en qué estado está cada una. Cada conexión puede
  tener como mucho 50 pendientes en un viaje: con esas, no sugiere más hasta que el usuario
  resuelva alguna.
- Lo que crea o edita un agente lleva en su lista y en su ficha la marca "Añadido por" o "Editado
  por" con el nombre de la conexión; editarlo desde la web la quita. Lo que escribe un agente se
  muestra siempre como texto.

### Android: qué hay y qué no respecto a la web

- Hay: viajes con vuelos, alojamientos, actividades, gastos, maleta, documentos, tareas,
  inmersiones vinculadas y mapa (`apps/android/app/trips/[id]/`); módulo de buceo con inmersiones,
  sitios, equipo, certificaciones y estadísticas (`apps/android/app/dives/`); importación con IA
  en modo manual de tres pasos (`apps/android/src/components/import/`), también con la maleta de
  cada objeto como en la web (`apps/android/src/db/packing.ts`); maletas en la sección de
  equipaje, con las vistas por categoría y por maleta, búsqueda, filtro de pendientes, selección
  múltiple, copiar de otro viaje, compartir una maleta y la misma lista predeterminada que la web
  (`apps/android/app/trips/[id]/packing.tsx`, `DEFAULT_PACKING_ITEMS` de
  `packages/shared/packing.ts`); ajustes de tema, idioma, sistema
  de unidades (métrico o imperial, para el peso de las maletas) y plan
  (`apps/android/app/settings.tsx`, `apps/android/src/contexts/UnitsContext.tsx`).
- No hay: cuenta ni autenticación; destinos como sección (no existe tabla, ver `docs/datos.md`);
  importación de Diving Log; vídeos de inmersión; panel de administración.
- Límite gratuito: un viaje (`FREE_TRIP_LIMIT` en `apps/android/src/lib/pro-limits.ts`). Con más,
  los viajes más antiguos quedan bloqueados para edición (`isTripLocked` en
  `apps/android/src/db/trips.ts`, `apps/android/src/contexts/TripLockContext.tsx`). La compra de
  Pro no existe todavía: `isPro` es un estado en memoria que solo se puede activar en desarrollo
  (`apps/android/src/contexts/ProContext.tsx`, `apps/android/app/settings.tsx`).
- Sync con la web: no existe aún; solo está el indicador `SYNC_ENABLED` resuelto en
  `apps/android/app.config.ts` (`CLAUDE.md`, sección "Variantes de build").

## Idiomas

Español e inglés en las dos apps.

- Web: textos en `apps/web/src/i18n/es.ts` y `apps/web/src/i18n/en.ts`, tipados por
  `apps/web/src/i18n/index.ts` (`WebTKeys` sale de `es.ts`). El idioma se resuelve en
  `apps/web/src/lib/locale.ts`: cookie `locale` si es válida; si no, `Accept-Language`; si no,
  inglés. El selector de la barra escribe esa cookie
  (`apps/web/src/contexts/LanguageContext.tsx`). El atributo `lang` del `<html>` es fijo `es`
  (`apps/web/src/app/layout.tsx`).
- Android: textos en `apps/android/src/i18n/es.ts` y `apps/android/src/i18n/en.ts`. El idioma
  inicial es el del sistema (español si el código es `es`, inglés en otro caso) y la elección se
  guarda en AsyncStorage (`apps/android/src/contexts/I18nContext.tsx`). Hay textos fijos fuera de
  i18n en la navegación del viaje: las pestañas "Alojam." y "Más" y el título por defecto "Viaje"
  (`apps/android/app/trips/[id]/_layout.tsx`).
- Regla para planes futuros: todo texto nuevo va en los dos ficheros de idioma de cada app que
  toque.
