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
- **El proxy no cubre `/api`.** Su `matcher` excluye `/api`, `_next/static`, `_next/image` y
  `favicon.ico` (`apps/web/src/proxy.ts`); cada ruta de `apps/web/src/app/api/` hace su propia
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

## Integraciones externas

Variables de entorno solo por nombre. Todas las de la web se leen en `apps/web/src`.

| Integración | Dónde | Variables | Si faltan |
|---|---|---|---|
| OAuth Google | `apps/web/src/lib/auth.config.ts` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | El proveedor no se registra y su botón no aparece (`apps/web/src/app/auth/signin/page.tsx`) |
| OAuth GitHub | `apps/web/src/lib/auth.config.ts` | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | Igual que Google |
| Enlace por email (Resend) | `apps/web/src/lib/auth.ts` | `RESEND_API_KEY`, `EMAIL_FROM` | Sin `RESEND_API_KEY` no hay login por email ni aviso al administrador de altas nuevas; `EMAIL_FROM` tiene un valor por defecto en el código |
| Aviso de alta al administrador | `apps/web/src/lib/auth.ts`, `notifyAdmin` | `ADMIN_EMAIL`, `AUTH_URL` | Sin `ADMIN_EMAIL` no se envía el aviso ni hay administrador automático; `AUTH_URL` solo forma el enlace del email y tiene valor por defecto |
| Login de desarrollo | `apps/web/src/lib/auth.ts` | `DEV_ADMIN_EMAIL`, `DEV_ADMIN_PASSWORD`, `ALLOW_DEV_LOGIN` | Sin las dos primeras el proveedor no existe; en producción, además, hace falta `ALLOW_DEV_LOGIN` |
| AgentOS (importación automática) | `apps/web/src/actions/agentos.ts`, `apps/web/src/app/(app)/trips/[tripId]/page.tsx` | `AGENTOS_URL`, `AGENTOS_API_KEY` | El asistente solo ofrece el modo manual; la acción lanza "AgentOS no está configurado en este entorno" |
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
(esquemas Zod de la importación) e `import-prompt.ts` (prompts manual y de AgentOS). Lo importan
las dos apps como `@tripplanner/shared`: un cambio aquí afecta a la web y a Android a la vez, y la
base de datos de Android depende de `country-names.ts` en su migración 7
(`apps/android/src/db/database.ts`).

## Tests

- Web: `apps/web/src/__tests__/`, con Vitest (`apps/web/package.json`, script `test`). Cómo se
  lanzan: `CLAUDE.md`, "Comandos de desarrollo".
- Android y `packages/shared`: no tienen tests propios ni script `test` en su `package.json`. Los
  esquemas compartidos se prueban desde `apps/web/src/__tests__/`.

## Despliegue

Ver `CLAUDE.md`, secciones "Entornos web" y "Estrategia de ramas".
