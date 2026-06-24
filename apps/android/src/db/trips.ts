import { db } from "./database";

export interface Trip {
  id: number;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  currency: string;
  budget: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTripInput {
  name: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  currency?: string;
  budget?: number;
}

export function listTrips(): Trip[] {
  return db.getAllSync<Trip>("SELECT * FROM trips ORDER BY created_at DESC");
}

export function getTrip(id: number): Trip | null {
  return db.getFirstSync<Trip>("SELECT * FROM trips WHERE id = ?", [id]) ?? null;
}

export function createTrip(input: CreateTripInput): Trip {
  const result = db.runSync(
    `INSERT INTO trips (name, description, start_date, end_date, currency, budget)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      input.name,
      input.description ?? null,
      input.start_date ?? null,
      input.end_date ?? null,
      input.currency ?? "EUR",
      input.budget ?? null,
    ]
  );
  return getTrip(result.lastInsertRowId)!;
}

export function updateTrip(id: number, input: Partial<CreateTripInput>): void {
  db.runSync(
    `UPDATE trips
     SET name = COALESCE(?, name),
         description = COALESCE(?, description),
         start_date = COALESCE(?, start_date),
         end_date = COALESCE(?, end_date),
         currency = COALESCE(?, currency),
         budget = COALESCE(?, budget),
         updated_at = datetime('now')
     WHERE id = ?`,
    [
      input.name ?? null,
      input.description ?? null,
      input.start_date ?? null,
      input.end_date ?? null,
      input.currency ?? null,
      input.budget ?? null,
      id,
    ]
  );
}

export function deleteTrip(id: number): void {
  db.runSync("DELETE FROM trips WHERE id = ?", [id]);
}

export function countTrips(): number {
  const row = db.getFirstSync<{ count: number }>(
    "SELECT COUNT(*) as count FROM trips"
  );
  return row?.count ?? 0;
}
