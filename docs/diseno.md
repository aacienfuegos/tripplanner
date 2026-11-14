# Diseño

Extraído del código actual de `develop`. Describe lo que hay; no propone cambios. Lo marcado como
"uso observado" es un recuento del código, no una norma.

## Web

### Tokens

Fuente: `apps/web/src/app/globals.css`. Son los tokens de shadcn en escala de grises (croma 0),
salvo `--destructive` y `--sidebar-primary` en oscuro.

| Token | `:root` (claro) | `.dark` (oscuro) |
|---|---|---|
| `--background` | `oklch(1 0 0)` | `oklch(0.145 0 0)` |
| `--foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` |
| `--card` | `oklch(1 0 0)` | `oklch(0.205 0 0)` |
| `--card-foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` |
| `--popover` | `oklch(1 0 0)` | `oklch(0.205 0 0)` |
| `--popover-foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` |
| `--primary` | `oklch(0.205 0 0)` | `oklch(0.922 0 0)` |
| `--primary-foreground` | `oklch(0.985 0 0)` | `oklch(0.205 0 0)` |
| `--secondary` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` |
| `--secondary-foreground` | `oklch(0.205 0 0)` | `oklch(0.985 0 0)` |
| `--muted` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` |
| `--muted-foreground` | `oklch(0.556 0 0)` | `oklch(0.708 0 0)` |
| `--accent` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` |
| `--accent-foreground` | `oklch(0.205 0 0)` | `oklch(0.985 0 0)` |
| `--destructive` | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` |
| `--border` | `oklch(0.922 0 0)` | `oklch(1 0 0 / 10%)` |
| `--input` | `oklch(0.922 0 0)` | `oklch(1 0 0 / 15%)` |
| `--ring` | `oklch(0.708 0 0)` | `oklch(0.556 0 0)` |
| `--chart-1` | `oklch(0.87 0 0)` | `oklch(0.87 0 0)` |
| `--chart-2` | `oklch(0.556 0 0)` | `oklch(0.556 0 0)` |
| `--chart-3` | `oklch(0.439 0 0)` | `oklch(0.439 0 0)` |
| `--chart-4` | `oklch(0.371 0 0)` | `oklch(0.371 0 0)` |
| `--chart-5` | `oklch(0.269 0 0)` | `oklch(0.269 0 0)` |
| `--sidebar` | `oklch(0.985 0 0)` | `oklch(0.205 0 0)` |
| `--sidebar-foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` |
| `--sidebar-primary` | `oklch(0.205 0 0)` | `oklch(0.488 0.243 264.376)` |
| `--sidebar-primary-foreground` | `oklch(0.985 0 0)` | `oklch(0.985 0 0)` |
| `--sidebar-accent` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` |
| `--sidebar-accent-foreground` | `oklch(0.205 0 0)` | `oklch(0.985 0 0)` |
| `--sidebar-border` | `oklch(0.922 0 0)` | `oklch(1 0 0 / 10%)` |
| `--sidebar-ring` | `oklch(0.708 0 0)` | `oklch(0.556 0 0)` |
| `--radius` | `0.625rem` | (no se redefine) |

Mapeo a Tailwind en el segundo bloque `@theme inline` del mismo fichero: cada token anterior se
expone como `--color-<token>` (de ahí clases como `bg-primary` o `text-muted-foreground`), y los
radios se derivan de `--radius`: `--radius-sm` 0.6x, `--radius-md` 0.8x, `--radius-lg` 1x,
`--radius-xl` 1.4x, `--radius-2xl` 1.8x, `--radius-3xl` 2.2x y `--radius-4xl` 2.6x. El modo
oscuro es la variante `dark` ligada a la clase `.dark` (`@custom-variant dark`).

Uso observado (búsqueda de `chart-[1-5]` y `sidebar` en `apps/web/src`, 2026-10-13): los tokens
`chart-*` y `sidebar-*` están definidos pero ningún componente los usa.

Fuera de los tokens hay clases de la paleta estándar de Tailwind para estados y tipos de
elemento, sobre todo `emerald`, `amber`, `blue` y `green` (uso observado: `grep -rhoE
'\b(bg|text|border)-(emerald|amber|blue|green|...)-[0-9]+' apps/web/src`, 2026-10-13; por ejemplo
las filas de la cronología de `apps/web/src/app/(app)/trips/[tripId]/page.tsx`). El gráfico de
perfil de inmersión usa hex fijos en SVG (`apps/web/src/components/dives/DiveProfileChart.tsx`,
con `#2563eb` como el más repetido).

### Tema claro y oscuro

`apps/web/src/components/layout/theme-provider.tsx` envuelve `next-themes` con `attribute="class"`,
tema por defecto `system` y el nonce de la CSP. `apps/web/src/components/layout/theme-toggle.tsx`
es un desplegable con Claro, Oscuro y Sistema en la barra.

### Tipografía

- Geist vía `next/font/google`, expuesta como `--font-sans` (`apps/web/src/app/layout.tsx`) y
  aplicada al `html` (`font-sans` en la capa base de `globals.css`). `--font-heading` apunta a la
  misma.
- `--font-mono` apunta a `--font-geist-mono`, que no se define en ningún sitio: no se carga Geist
  Mono ni otra fuente mono (búsqueda de `geist-mono` y `Geist_Mono` en `apps/web/src`). La clase
  `font-mono` sí se usa (fechas de la ficha del viaje, entre otros). Qué fuente acaba pintando el
  navegador en esos casos: Pendiente de confirmar.

### Componentes reutilizables

`apps/web/src/components/ui/` (shadcn sobre `@base-ui/react`; sin `asChild`, ver la sección de
shadcn de `CLAUDE.md`):

| Fichero | Qué es |
|---|---|
| `avatar.tsx` | Avatar con imagen, iniciales, grupo y distintivo |
| `badge.tsx` | Etiqueta; `badgeVariants` con `default`, `secondary`, `destructive`, `success`, `warning`, `outline`, `ghost`, `link` |
| `button.tsx` | Botón; `buttonVariants` con variantes `default`, `outline`, `secondary`, `ghost`, `destructive`, `link` y tamaños `default`, `xs`, `sm`, `lg`, `icon`, `icon-xs`, `icon-sm`, `icon-lg`. Para enlaces con aspecto de botón, `buttonVariants()` sobre `<Link>` |
| `card.tsx` | Tarjeta con cabecera, título, descripción, acción, contenido y pie |
| `confirm-dialog.tsx` | Hook `useConfirmDialog` que devuelve una promesa con la respuesta; todas sus llamadas son confirmaciones de borrado (`confirmLabel: t.delete`) |
| `country-select.tsx` | Selector de país con los códigos de `@tripplanner/shared` |
| `dialog.tsx` | Diálogo modal; contenedor de los formularios de sección |
| `dropdown-menu.tsx` | Menú desplegable (menú de usuario, tema, idioma, "Más" del viaje) |
| `input.tsx`, `textarea.tsx`, `label.tsx` | Campos de formulario |
| `select.tsx` | Selector; `onValueChange` recibe `string \| null` (ver `CLAUDE.md`) |
| `separator.tsx` | Separador |
| `sheet.tsx` | Panel lateral; solo lo usa `apps/web/src/components/dives/media/MediaPicker.tsx` |
| `skeleton.tsx` | Bloque de carga; solo en los mapas |
| `sonner.tsx` | `Toaster` de `sonner` con el tema de `next-themes` e iconos de lucide |
| `tabs.tsx` | Pestañas; `tabsListVariants` con `default` y `line` |

`apps/web/src/components/layout/`: `navbar.tsx` (barra superior y barra inferior móvil),
`section-header.tsx` (miga de pan, título con icono y navegación del viaje),
`theme-provider.tsx`, `theme-toggle.tsx`, `language-toggle.tsx` y `ClientProviders.tsx`
(idioma y estado de la importación en curso, con su indicador flotante
`apps/web/src/components/import/ImportStatusFloat.tsx`). Fuera de `ui/`,
`apps/web/src/components/trips/trip-status-badge.tsx` mapea el estado del viaje a una variante de
`Badge`.

### Iconos

`lucide-react` (importado en `apps/web/src/components/layout/navbar.tsx` y en el resto de
componentes).

### Notificaciones

`sonner`: `Toaster` con `richColors` arriba a la derecha (`apps/web/src/app/layout.tsx`),
definido en `apps/web/src/components/ui/sonner.tsx`.

## Android

### No hay sistema de tokens

`apps/android/tailwind.config.js` solo extiende una escala `primary` (`50` `#eff6ff`, `100`
`#dbeafe`, `500` `#3b82f6`, `600` `#2563eb`, `700` `#1d4ed8`, que son los azules estándar de
Tailwind) y ninguna clase la usa: `grep -rn "primary" apps/android/app apps/android/src`, sin
contar `i18n`, no devuelve nada (2026-10-13). `apps/android/global.css` solo trae las tres
directivas `@tailwind`. Los colores salen de la paleta estándar de Tailwind en `className` y de
hex sueltos en props de estilo (`color`, `tabBarActiveTintColor`, `backgroundColor`).

Uso observado, medido el 2026-10-13 sobre `apps/android/app` y `apps/android/src`:

- Familias de clase (`grep -rhoE '\b(bg|text|border)-(slate|gray|zinc|...)-'`): `slate` 405,
  `gray` 250, `zinc` 207, `blue` 46, `red` 39, `amber` 33, `cyan` 26; el resto, menos de 15.
- Clases más repetidas: `text-slate-400` (114), `text-slate-500` (95), `text-white` (88),
  `bg-white` (78), `text-gray-700` (75), `text-gray-900` (59), `border-gray-300` (57),
  `bg-zinc-900` (50, fondos en oscuro), `bg-zinc-950` (33).
- Hex más repetidos (`grep -rhoiE '"#[0-9a-f]{6}"'`): `#374151` (20, texto de cabecera en
  claro), `#f1f5f9` (19, texto de cabecera en oscuro y borde de pestañas en claro), `#6b7280`
  (18), `#2563eb` (16, color activo de las pestañas del viaje y del botón flotante por defecto),
  `#9ca3af` y `#94a3b8` (14 cada uno), `#0e7490` (13).
- Acento por módulo: azul `#2563eb` en viajes (`apps/android/app/trips/[id]/_layout.tsx`,
  `apps/android/src/components/SectionFAB.tsx`) y cian `#0891b2` en buceo
  (`apps/android/app/dives/_layout.tsx`). Las secciones de la hoja "Más" llevan cada una su color
  (`apps/android/app/trips/[id]/_layout.tsx`, `MORE_SECTIONS`).
- Cabeceras y barras: fondo `#ffffff` en claro y `#18181b` en oscuro, en los tres layouts de
  navegación.

### Tema

`apps/android/src/contexts/ThemeContext.tsx`: preferencia sistema, claro u oscuro aplicada con
`setColorScheme` de NativeWind y guardada en AsyncStorage. Las pantallas usan clases `dark:` y,
para los hex, comprueban `colorScheme === "dark"`. `app.config.ts` declara
`userInterfaceStyle: "automatic"`.

### Tipografía

La del sistema: no hay `fontFamily` ni `useFonts` en `apps/android/app` ni `apps/android/src`
(búsqueda del 2026-10-13, 0 resultados). Los tamaños y pesos van por clase de Tailwind o en
`screenOptions` (`fontSize: 17`, `fontWeight: "700"` en títulos de cabecera; `10` y `"500"` en
etiquetas de pestaña).

### Componentes reutilizables

`apps/android/src/components/`:

| Fichero | Qué es |
|---|---|
| `ModuleSwitcherHeader.tsx` | Título de cabecera que cambia entre Viajes y Buceo |
| `SectionFAB.tsx` | Botón flotante de alta, con color configurable y estado bloqueado |
| `SectionHeaderRight.tsx` | Iconos de mapa, importación y edición en la cabecera de las secciones del viaje |
| `DatePickerInput.tsx` | Campo de fecha con `@react-native-community/datetimepicker` |
| `CountryPickerInput.tsx` | Selector de país en modal con búsqueda, con los códigos de `@tripplanner/shared` |
| `DiveProfileChart.tsx` | Perfil de inmersión dibujado con `react-native-svg` |
| `DiveSitesMapModal.tsx` | Mapa de sitios de buceo en WebView (Leaflet y MapLibre) |
| `forms/*FormModal.tsx` | Un formulario modal por entidad (13 ficheros) |
| `import/` | Asistente de importación: `ImportWizard.tsx`, `PromptStep.tsx`, `PasteStep.tsx`, `ReviewStep.tsx` |

### Iconos e identidad por variante

- Iconos: Ionicons de `@expo/vector-icons` (por ejemplo, `apps/android/app/trips/[id]/_layout.tsx`).
- Identidad: `apps/android/app.config.ts` elige nombre, icono, icono adaptativo, splash y color de
  fondo por variante. TripPlanner usa `apps/android/assets/full/` con fondo `#1D6FDC`; Sub usa
  `apps/android/assets/sub/` con fondo `#0B4965`.

## En qué difieren web y Android

- **Color principal.** El `--primary` de la web es gris casi negro en claro y casi blanco en
  oscuro, sin tono; Android no tiene principal efectivo y usa azul `#2563eb` en viajes y cian
  `#0891b2` en buceo. El acento azul de la web aparece solo en clases sueltas y en el gráfico de
  perfil.
- **Grises.** La web los toma de sus tokens (croma 0, sin tono); Android mezcla `slate`, `gray` y
  `zinc` de Tailwind, que tienen matices distintos.
- **Fuente.** Geist en la web; la del sistema en Android.
- **Tema.** Las dos apps tienen claro, oscuro y sistema; en la web lo persiste `next-themes`, en
  Android AsyncStorage.
- **Iconos.** `lucide-react` en la web; Ionicons en Android.
- **Componentes.** La web tiene una librería (`apps/web/src/components/ui/`); Android no tiene
  componentes base (botón, tarjeta, campo), solo los de dominio de la tabla anterior.
- **Avisos.** Toasts de `sonner` en la web; `Alert.alert` nativo en Android.
