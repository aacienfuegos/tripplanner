---
name: expo-sqlite
description: Expo SDK 54 SQLite — inicialización, migraciones con PRAGMA user_version, queries y patrones del proyecto
metadata:
  type: skill
---

# Expo SQLite (SDK 54)

## Inicialización

Solo en `app/_layout.tsx` al arrancar la app. Una sola vez.

```ts
import { initDatabase } from "@/src/db/database";
// En el root layout, antes de renderizar
await initDatabase();
```

## Migraciones con PRAGMA user_version

Sistema de migraciones versionadas sin ORM:

```ts
// src/db/database.ts
export function initDatabase() {
  const { user_version } = db.getFirstSync<{ user_version: number }>(
    'PRAGMA user_version'
  )!;

  if (user_version < 1) {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS trips (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        start_date TEXT,
        end_date TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
      PRAGMA user_version = 1;
    `);
  }

  // Para añadir tablas/columnas en futuras versiones:
  if (user_version < 2) {
    db.execSync(`
      ALTER TABLE trips ADD COLUMN destination TEXT;
      PRAGMA user_version = 2;
    `);
  }
}
```

**NUNCA** resetear `user_version` a un valor menor. Las migraciones son one-way.

## Convención de columnas

**snake_case** en SQLite y también en los tipos TypeScript de este proyecto:

```ts
// CORRECTO — consistente con SQLite
type Trip = {
  id: number;
  trip_id: number;       // FK
  start_date: string;
  flight_number: string;
}

// INCORRECTO — no usar camelCase en los tipos de DB
type Trip = {
  startDate: string;   // ← no
}
```

## Queries seguras (sin SQL injection)

Siempre usar placeholders `?`:

```ts
// CORRECTO
const trip = db.getFirstSync<Trip>(
  'SELECT * FROM trips WHERE id = ?',
  [tripId]
);

// INCORRECTO — vulnerable a SQL injection
const trip = db.execSync(`SELECT * FROM trips WHERE id = ${tripId}`);
```

## Operaciones bulk (para import wizard)

```ts
// src/db/flights.ts
export function bulkCreateFlights(tripId: number, flights: ImportFlight[]) {
  db.withTransactionSync(() => {
    for (const f of flights) {
      db.runSync(
        `INSERT INTO flights (trip_id, flight_number, ...) VALUES (?, ?, ...)`,
        [tripId, f.flightNumber, ...]
      );
    }
  });
}
```

## Web no soportada

`expo-sqlite` v16 usa `Atomics.wait()` — bloqueado por W3C en navegadores.
`src/db/database.web.ts` es un stub no-op. La app es solo Android.

## Tablas actuales (en orden de migración)

1. `trips` — viajes
2. `flights` — vuelos
3. `accommodations` — alojamientos
4. `activities` — actividades
5. `expenses` — gastos
6. `packing` — maleta
7. `documents` — documentos
8. `tasks` — tareas del viaje

Para añadir una nueva sección: incrementar `user_version` y añadir el `if (user_version < N)` block.
