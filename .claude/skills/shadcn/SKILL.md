---
name: shadcn
description: shadcn/ui 4.7+ con @base-ui/react — diferencias críticas vs Radix y patrones correctos
metadata:
  type: skill
---

# shadcn/ui 4.7+ (@base-ui/react)

Esta versión usa `@base-ui/react` en vez de Radix UI. Hay breaking changes importantes.

## asChild no existe

```tsx
// INCORRECTO — @base-ui no tiene asChild
<Button asChild>
  <Link href="/ruta">Texto</Link>
</Button>

// CORRECTO — usar buttonVariants + Link directamente
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";

<Link href="/ruta" className={buttonVariants({ variant: "outline" })}>
  Texto
</Link>

// También funciona para cualquier variante:
<Link href="/ruta" className={buttonVariants({ variant: "ghost", size: "sm" })}>
  Texto
</Link>
```

## Select — onValueChange recibe null

```tsx
// INCORRECTO — TypeScript falla: Dispatch<SetStateAction<string>> no acepta null
<Select value={value} onValueChange={setValue}>

// CORRECTO — filtrar null antes de setState
<Select value={value} onValueChange={(v) => v !== null && setValue(v)}>
```

## Componentes disponibles

Los componentes están en `apps/web/src/components/ui/`. Antes de crear un componente custom,
verificar si ya existe aquí.

## Cómo añadir nuevos componentes

```bash
cd apps/web
npx shadcn@latest add [component-name]
```

El componente se genera en `src/components/ui/[component-name].tsx`.
