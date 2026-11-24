# Técnico

Versiones, comandos, estructura del monorepo, patrones de Next.js, Prisma, shadcn y NativeWind, y
cómo añadir una sección nueva: todo eso está en `CLAUDE.md` y no se repite aquí. Este documento
recoge solo lo que no está allí y sale del código.

## Límites y restricciones

- **Android no funciona en web.** `expo-sqlite` no se puede usar en el navegador (motivo en
  `CLAUDE.md`, sección ANDROID). `CLAUDE.md` describe un stub web de la base de datos y un aviso
  en `apps/android/app/_layout.tsx`, pero en `develop` no existe ningún fichero `.web.*` en
  `apps/android` ni comprobación de `Platform.OS === "web"` en `app/` ni `src/`: el layout llama a
  `initDatabase()` sin distinguir plataforma.
- **React fijado.** `react` y `react-dom` van a versión exacta en `dependencies` y `overrides` del
  `package.json` raíz; cambiarlos rompe el renderer de React Native (`CLAUDE.md`, "Nota crítica").
- **Módulos nativos de Android.** Las versiones de gesture-handler, reanimated, webview,
  async-storage, screens y safe-area-context las fija el SDK de Expo, no Dependabot (`CLAUDE.md`,
  sección ANDROID).
- **CSP con nonce en la web.** `apps/web/src/proxy.ts` genera un nonce por petición y fija la
  cabecera `Content-Security-Policy`: scripts con nonce y `strict-dynamic` (más `unsafe-eval` solo
  fuera de producción), estilos `unsafe-inline`, imágenes de cualquier origen `https:`,
  `connect-src` limitado al propio origen y a los dos orígenes de teselas del mapa, workers `blob:`
  y `frame-ancestors 'none'`. Un recurso externo nuevo que haga peticiones desde el navegador
  exige tocar `buildCsp` en ese fichero.
- **El proxy no cubre `/api` ni `/.well-known`.** Su `matcher` excluye `/api`, `/.well-known`,
  `_next/static`, `_next/image` y `favicon.ico` (`apps/web/src/proxy.ts`); cada ruta de `apps/web/src/app/api/` hace su propia
  comprobación (ver `docs/datos.md`, "Autenticación").
- **Polyfills de `Intl` en Android.** `Intl.DisplayNames` e `Intl.Locale` se cargan con
  `@formatjs` al arrancar (`apps/android/app/_layout.tsx`) porque Hermes no los trae.
- **Datos de prueba en Android.** En desarrollo (`__DEV__`) se vuelve a sembrar un dataset en cada
  arranque (`apps/android/app/_layout.tsx`, `apps/android/src/db/seed.ts`).
- **La imagen de ejecución no lleva toolchain.** En `apps/web/Dockerfile`, `python3`, `make` y `g++`
  solo están en `base`, para las etapas de build (`builder` y `prod-deps`); `runner` sale de
  `runtime-base`, sin ellos, y carga `better-sqlite3` y `sharp` durante el build para que un addon
  roto pare el build y no el arranque. La capa de `apk upgrade` de `runtime-base` se reconstruye en
  cada build (`no-cache-filters` en los workflows de deploy) para que los arreglos de Alpine entren
  sin esperar a una imagen base nueva. No se debe volver a poner `runner` sobre `base`.
- **La imagen de ejecución solo lleva `dependencies`.** `prod-deps` instala con `npm ci --omit=dev`,
  así que lo que solo usan el build o una CLI de desarrollo va en `devDependencies` de
  `apps/web/package.json`. `shadcn` es una de esas CLI: en `dependencies` metía en la imagen su
  árbol (`@modelcontextprotocol/sdk`, `express`, `body-parser`), que el gate de Trivy acaba
  encontrando con CVE (#393).
- **El gate de `npm audit` necesita red.** `scripts/npm-audit.mjs` cruza cada entrada del lockfile
  que no es un workspace con su manifiesto de `registry.npmjs.org` (aristas y `hasInstallScript`),
  porque `npm ci` monta el árbol con lo que dice el lockfile. Si el registry no responde, falla
  cerrado (#430).

## Capa de servicio

Las escrituras de viajes, de sus secciones y de buceo están en `apps/web/src/lib/services/`, un
fichero por área, con `import "server-only"`. Las server actions de `apps/web/src/actions/` son una
capa fina: parsean el formulario con su esquema de `apps/web/src/lib/schemas.ts`, lo convierten a la
entrada tipada y llaman al servicio con el actor web. Las herramientas MCP del acceso de agentes
usan la misma capa con el actor de agente (ver "Servidor MCP").

- **Entrada tipada**: `apps/web/src/lib/agent-schemas.ts`, con números, booleanos y fechas locales
  (`YYYY-MM-DD` o `YYYY-MM-DDTHH:mm`, como los formularios), los mismos obligatorios y enums que los
  formularios, `http` o `https` en los enlaces y límites de 200 caracteres en textos cortos, 5000
  en notas y descripciones, 2048 en URL y 100 elementos en listas. No llevan valores por defecto:
  al crear se usan los de la base de datos.
- **Edición parcial**: lo que no llega en la entrada no se escribe (Prisma omite los `undefined`).
  Cada campo se valida con su esquema y ninguno depende de otro, así que el resultado completo es
  válido. Solo se lee lo guardado cuando un efecto lo necesita: importe y moneda de un gasto,
  dirección de un sitio, día y hora de una inmersión.
- **Errores** (`apps/web/src/lib/services/errors.ts`): `NotFoundError`, `InputError` (campo y
  motivo), `DuplicateError` (el existente), `LimitError`, `ScopeError` y `ConflictError` (este, para
  los borrados de la fase 4). Un P2025 de Prisma se convierte en `NotFoundError`.
- **Efectos**: los servicios hacen lo que hacían las acciones: geocodificar alojamientos,
  actividades y sitios, convertir gastos a la moneda del viaje y recalcularlos al cambiarla,
  reordenar destinos, renumerar inmersiones, desmarcar el equipaje que cambia de maleta y
  `revalidatePath`. Con un agente, el equipaje va a "Sin maleta" y su edición no cambia la maleta.
- **Duplicados**: los criterios por tipo de elemento son funciones puras en
  `apps/web/src/lib/duplicates.ts`; `checkDuplicates` de la importación IA usa las de sus seis
  secciones, y las herramientas de crear de los agentes, todas
  (`apps/web/src/lib/services/agent-duplicates.ts`). La web no busca duplicados al crear.
- **Registro y marca** (`apps/web/src/lib/services/audit.ts`): con un agente, la escritura y su
  entrada de `AgentAuditEntry` van en una transacción interactiva; en una edición, la entrada
  guarda los campos que cambian con su valor de antes y de después, sin los que deriva el propio
  servicio (coordenadas, conversión, número de inmersión, orden). La web escribe sin transacción,
  como antes, y pone `agentGrantId` a `null` en todo lo que toca, interruptores incluidos. Cada
  escritura de agente borra las entradas del usuario de más de 90 días, sin proceso programado.
- **Tests**: los de servicios usan `apps/web/src/__tests__/helpers/fake-service-db.ts`, una base
  en memoria con dos usuarios, y corren cada caso como los dos. Vitest resuelve `server-only` a
  un módulo vacío (`apps/web/vitest.config.ts`), como hace Next en el servidor.

## Servidor de autorización OAuth

El flujo y los modelos están en `docs/datos.md`, "Acceso de agentes (OAuth)". Aquí, lo que
condiciona el despliegue y el mantenimiento (`apps/web/src/lib/oauth/`).

- **Emisor.** Es `AUTH_URL`, que tiene que ser `https`; el recurso, `${AUTH_URL}/api/mcp`. El
  emisor nunca sale de la cabecera `Host`. Sin `AUTH_URL` o con una que no sea `https`, las rutas
  de OAuth responden 503, `/oauth/authorize` lo dice y `/profile/agents` avisa de que no está
  configurado; en local (`http://localhost`) queda apagado. Un token está ligado al recurso:
  si cambia el dominio, hay que volver a autorizar.
- **Tokens.** 32 bytes de `crypto.randomBytes` con prefijo (`tpac_`, `tpat_`, `tprt_`) para que los
  detecte el escaneo de secretos. En la base de datos solo va su SHA-256, que se calcula antes de
  cualquier consulta. La única comparación directa de un secreto es la del `code_verifier`, en
  tiempo constante (`apps/web/src/lib/timing-safe.ts`).
- **Límites de uso** (`apps/web/src/lib/rate-limit.ts`): ventana deslizante en memoria sobre
  `BoundedCache`. `/api/oauth/token`: 20 por minuto e IP, con todas las peticiones, y 60 por
  minuto y cliente, contando solo las fallidas y mirado después de comprobar la credencial, así
  que un código o un refresco válidos nunca reciben 429 por el cliente. `/api/oauth/revoke`: 20
  por minuto e IP, antes de leer el cuerpo. `/oauth/authorize`: 30 por minuto e IP. La IP sale de
  `CF-Connecting-IP` y, si falta, de `X-Real-IP`. Valen para el contenedor único de hoy: se
  reinician con él y, con varias réplicas, habría que moverlos a la base de datos.
- **Salida a Internet nueva: CIMD** (`apps/web/src/lib/oauth/cimd.ts`). Un `client_id` con forma de
  URL `https` hace que el servidor descargue ese documento, con `node:https`: solo el puerto 443,
  sin seguir redirecciones, 5 segundos y 64 KB como máximo, `application/json`. Un `lookup` propio
  comprueba todas las direcciones de la resolución y rechaza la conexión si alguna no es unicast
  global (rangos de uso especial de IANA en un `BlockList`); la conexión va a esas mismas
  direcciones. Una IP literal pasa por la misma lista antes de conectar, porque Node no llama al
  `lookup` para ella. `::ffff:0:0/96` va en un `BlockList` aparte, solo para IPv6: en el mismo
  `BlockList`, Node compara con él todas las IPv4. El documento se guarda en `OAuthClient` y se
  vuelve a descargar pasadas 24 horas.
- **Logs.** Las rutas de OAuth no registran cabeceras, cuerpos, URL con query ni valores de token
  o código, tampoco los inválidos. Un error inesperado se registra con su clase
  (`[oauth/token] server_error`), no con su mensaje.
- **Metadatos.** Se escriben a mano en `apps/web/src/lib/oauth/config.ts`. Del SDK de MCP, el
  servidor de autorización no usa nada.

## Servidor MCP

Lo que pueden hacer los agentes está en `docs/producto.md`, "Acceso de agentes (MCP)". Aquí, cómo
está hecho (`apps/web/src/lib/mcp/` y `apps/web/src/app/api/mcp/route.ts`).

- **SDK.** `@modelcontextprotocol/server` 2.4.0, versión exacta en `dependencies` de
  `apps/web/package.json`: entra en la imagen. Ya estaba en el lockfile como dependencia de
  desarrollo de `shadcn`; trae `@modelcontextprotocol/core` y usa el `zod` de la web.
- **Sin estado.** La pasarela de Paperclip habla la revisión `2025-11-25`, que el SDK sirve con
  `createMcpHandler(..., { legacy: "stateless" })`: un `McpServer` nuevo por petición, y `GET` y
  `DELETE` responden 405 en la ruta. La revisión `2026-07-28` va con `responseMode: "json"`, que el
  SDK avisa por consola una vez al cargar el módulo.
- **Orden de las comprobaciones** (`apps/web/src/lib/mcp/server.ts`), antes de que el SDK vea la
  petición: 503 sin emisor; 403 con un `Origin` presente que no sea el de `AUTH_URL`; 400 con el
  token en la query; el token bearer con `requireBearerAuth` del SDK y el verificador propio
  (`mcpTokenVerifier` en `apps/web/src/lib/oauth/verify.ts`), que da 401 con `resource_metadata`
  (y `error="invalid_token"` si había token); 429 con `Retry-After` pasadas 120 llamadas por minuto
  y conexión; un cuerpo de más de 1 MB, 413; y un `tools/call` de una herramienta del catálogo
  cuyo scope no tiene la conexión, 403 `insufficient_scope` con el scope que falta, sin ejecutar
  nada (en un lote, basta con una). `create_trip` y `update_trip` con una lista de viajes, 403
  `forbidden` sin desafío: no se arregla pidiendo más scopes.
- **El actor.** El verificador deja en `AuthInfo.token` la huella, nunca el valor, y el actor de
  agente en un `WeakMap` con `AuthInfo.extra` de clave, del que lo saca la fábrica del servidor:
  nada que llegue de fuera puede pasar por un actor.
- **Herramientas** (`apps/web/src/lib/mcp/tools/`, el catálogo en `index.ts`): cada una con nombre
  en `snake_case`, título, descripción en inglés, esquemas de entrada y de salida, anotaciones y
  su scope. El servidor de cada petición solo registra las que permiten los scopes de la
  conexión, las de crear y editar viajes solo con todos los viajes, y las de vídeos solo para un
  administrador con biblioteca. Los argumentos los valida la herramienta con
  `apps/web/src/lib/agent-schemas.ts`, no el SDK, para que un campo malo sea `invalid_input` con
  su nombre. La respuesta va en `structuredContent` y el mismo JSON en texto.
- **Lecturas** (`apps/web/src/lib/services/trip-reads.ts` y `dive-reads.ts`): con el usuario del
  actor en cada consulta, y la lista de viajes de la conexión en `list_trips`. Paginadas por `id`
  (`cursor` y `nextCursor`, 50 por defecto y 100 como máximo); `get_trip`, 500 elementos por
  sección como mucho, con `truncated`. Las fechas salen en el formato en que entran.
- **Logs.** `onerror` del SDK registra solo `error.name` y `error.message`; un error inesperado de
  una herramienta, su nombre y su clase (`[mcp] tool_error`). Nada de cabeceras, cuerpos ni
  tokens.

## Integraciones externas

Variables de entorno solo por nombre. Todas las de la web se leen en `apps/web/src`.

| Integración | Dónde | Variables | Si faltan |
|---|---|---|---|
| OAuth Google | `apps/web/src/lib/auth.config.ts` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | El proveedor no se registra y su botón no aparece (`apps/web/src/app/auth/signin/page.tsx`) |
| OAuth GitHub | `apps/web/src/lib/auth.config.ts` | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | Igual que Google |
| Enlace por email (Resend) | `apps/web/src/lib/auth.ts` | `RESEND_API_KEY`, `EMAIL_FROM` | Sin `RESEND_API_KEY` no hay login por email ni aviso al administrador de altas nuevas; `EMAIL_FROM` tiene un valor por defecto en el código |
| Aviso de alta al administrador | `apps/web/src/lib/auth.ts`, `notifyAdmin` | `ADMIN_EMAIL`, `AUTH_URL` | Sin `ADMIN_EMAIL` no se envía el aviso ni hay administrador automático; `AUTH_URL` forma el enlace del email y tiene valor por defecto |
| Servidor de autorización OAuth | `apps/web/src/lib/oauth/config.ts` | `AUTH_URL` | Sin una URL `https`, las rutas de OAuth responden 503 (ver "Servidor de autorización OAuth") |
| Documentos CIMD de clientes | `apps/web/src/lib/oauth/cimd.ts` | Ninguna | La URL la pone el cliente; si no se puede descargar o no es válida, la petición de autorización se rechaza sin redirigir |
| Login de desarrollo | `apps/web/src/lib/auth.ts` | `DEV_ADMIN_EMAIL`, `DEV_ADMIN_PASSWORD`, `ALLOW_DEV_LOGIN` | Sin las dos primeras el proveedor no existe; en producción, además, hace falta `ALLOW_DEV_LOGIN` |
| Biblioteca de vídeos y Jellyfin | `apps/web/src/lib/media-config.ts`, `apps/web/src/lib/jellyfin.ts` | `MEDIA_LIBRARY_PATH`, `JELLYFIN_URL`, `JELLYFIN_LIBRARY_PATH` | Sin las dos primeras no hay biblioteca: la pestaña de vídeos no aparece; `JELLYFIN_LIBRARY_PATH` es opcional |
| Mapas y teselas | Web: `apps/web/src/components/map/`, `apps/web/src/components/dives/DiveSitesMapView.tsx`; Android: `apps/android/app/trips/[id]/map.tsx`, `apps/android/src/components/DiveSitesMapModal.tsx` | Ninguna | Teselas de OpenFreeMap (orígenes en `connect-src` de `apps/web/src/proxy.ts`). En Android el mapa es una WebView que carga Leaflet, markercluster y MapLibre desde un CDN público |
| Geocodificación | `apps/web/src/lib/geocoding.ts`, `apps/android/src/lib/geocode.ts` | Ninguna | Nominatim de OpenStreetMap; si falla, devuelve `null` y el elemento queda sin coordenadas. La web limita el ritmo y cachea en memoria; Android resuelve antes los códigos IATA contra `apps/android/src/lib/data/iata-airports.json` |
| Tipos de cambio | `apps/web/src/lib/exchangeRate.ts` | Ninguna | API pública de tipos de cambio (constante `EXCHANGE_RATE_API`); si falla, devuelve `null` y el gasto se guarda sin conversión |
| Cifrado de tokens OAuth | `apps/web/src/lib/token-encryption.ts`, aplicado en `apps/web/src/lib/prisma.ts` | `TOKEN_ENCRYPTION_KEY` | Los tokens de `Account` se guardan en claro y se registra un error; al leer un token cifrado sin clave se devuelve `null` |
| Base de datos | `apps/web/src/lib/prisma.ts` | `DATABASE_URL` | Pendiente de confirmar el comportamiento exacto; el código usa el valor sin comprobarlo |

Android no tiene variables de entorno en tiempo de ejecución: `APP_VARIANT` y `SYNC_ENABLED` se
resuelven al compilar (`apps/android/app.config.ts`). Los campos sensibles de la base local
(documentos, referencias de reserva, notas) se cifran con claves guardadas en el Keystore vía
`expo-secure-store` (`apps/android/src/crypto/fieldEncryption.ts`).

## Paquete compartido

`packages/shared/index.ts` reexporta cuatro módulos: `currencies.ts` (catálogo de monedas),
`country-names.ts` (códigos ISO 3166-1 y nombres en español e inglés), `import-schemas.ts`
(esquemas Zod de la importación) e `import-prompt.ts` (prompt del modo manual). Lo importan
las dos apps como `@tripplanner/shared`: un cambio aquí afecta a la web y a Android a la vez, y la
base de datos de Android depende de `country-names.ts` en su migración 7
(`apps/android/src/db/database.ts`).

## Tests

- Web: `apps/web/src/__tests__/`, con Vitest (`apps/web/package.json`, script `test`). Cómo se
  lanzan: `CLAUDE.md`, "Comandos de desarrollo".
- Los de OAuth y MCP (`oauth-*.test.ts`, `mcp-*.test.ts`, `agents-actions.test.ts`) corren en el
  entorno `node` de Vitest (`// @vitest-environment node`), con el `Request` y el `Response` de
  Node: los de happy-dom filtran cabeceras. Usan `apps/web/src/__tests__/helpers/fake-oauth-db.ts`,
  una base en memoria en la que dos peticiones a la vez se intercalan en cada `await`, como dos
  peticiones reales; las carreras contra PostgreSQL se comprueban en staging. Las llamadas MCP las
  hace `apps/web/src/__tests__/helpers/mcp-client.ts` contra la ruta, como la pasarela de
  Paperclip; las herramientas, una a una, van sobre `fake-service-db.ts`.
- Android y `packages/shared`: no tienen tests propios ni script `test` en su `package.json`. Los
  esquemas compartidos se prueban desde `apps/web/src/__tests__/`.

## Despliegue

Ver `CLAUDE.md`, secciones "Entornos web" y "Estrategia de ramas".
