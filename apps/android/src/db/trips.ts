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

export interface TripSummary {
  flights: number;
  accommodations: number;
  activities: number;
  expenses: number;
  expensesTotal: number;
  packingPacked: number;
  packingTotal: number;
  tripStatus: "upcoming" | "ongoing" | "past";
  daysUntil: number | null; // positive = upcoming, negative = days ago ended
}

export function getTripSummary(tripId: number, currency: string): TripSummary {
  const today = new Date().toISOString().slice(0, 10);

  const trip = db.getFirstSync<{ start_date: string | null; end_date: string | null }>(
    "SELECT start_date, end_date FROM trips WHERE id = ?", [tripId]
  );

  let tripStatus: TripSummary["tripStatus"] = "upcoming";
  let daysUntil: number | null = null;

  if (trip?.start_date) {
    const start = trip.start_date.slice(0, 10);
    const end = trip.end_date?.slice(0, 10) ?? start;
    const msPerDay = 86400000;
    if (today >= start && today <= end) {
      tripStatus = "ongoing";
    } else if (today > end) {
      tripStatus = "past";
      daysUntil = -Math.round((new Date(today).getTime() - new Date(end).getTime()) / msPerDay);
    } else {
      tripStatus = "upcoming";
      daysUntil = Math.round((new Date(start).getTime() - new Date(today).getTime()) / msPerDay);
    }
  }

  const flights = (db.getFirstSync<{ n: number }>("SELECT COUNT(*) as n FROM flights WHERE trip_id = ?", [tripId])?.n ?? 0);
  const accommodations = (db.getFirstSync<{ n: number }>("SELECT COUNT(*) as n FROM accommodations WHERE trip_id = ?", [tripId])?.n ?? 0);
  const activities = (db.getFirstSync<{ n: number }>("SELECT COUNT(*) as n FROM activities WHERE trip_id = ?", [tripId])?.n ?? 0);
  const expenses = (db.getFirstSync<{ n: number }>("SELECT COUNT(*) as n FROM expenses WHERE trip_id = ?", [tripId])?.n ?? 0);
  const expensesTotal = (db.getFirstSync<{ total: number }>(
    "SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE trip_id = ? AND currency = ?",
    [tripId, currency]
  )?.total ?? 0);
  const packingRow = db.getFirstSync<{ packed: number; total: number }>(
    "SELECT SUM(CASE WHEN packed = 1 THEN 1 ELSE 0 END) as packed, COUNT(*) as total FROM packing_items WHERE trip_id = ?",
    [tripId]
  );

  return {
    flights,
    accommodations,
    activities,
    expenses,
    expensesTotal,
    packingPacked: packingRow?.packed ?? 0,
    packingTotal: packingRow?.total ?? 0,
    tripStatus,
    daysUntil,
  };
}
