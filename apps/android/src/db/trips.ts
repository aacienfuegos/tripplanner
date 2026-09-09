import { db } from "./database";
import { FREE_TRIP_LIMIT } from "@/lib/pro-limits";

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

// El límite free no solo bloquea crear viajes nuevos (trips/index.tsx) —
// también hay que aplicarlo retroactivamente si el usuario deja de ser Pro
// con varios viajes ya creados. Se mantiene editable el más reciente
// (mayor id); el resto pasa a solo lectura.
export function isTripLocked(tripId: number, isPro: boolean): boolean {
  if (isPro) return false;
  const row = db.getFirstSync<{ rank: number }>(
    "SELECT COUNT(*) as rank FROM trips WHERE id >= (SELECT id FROM trips WHERE id = ?)",
    [tripId]
  );
  return (row?.rank ?? 1) > FREE_TRIP_LIMIT;
}

export function lockedTripIds(isPro: boolean): Set<number> {
  if (isPro) return new Set();
  const trips = listTrips();
  if (trips.length <= FREE_TRIP_LIMIT) return new Set();
  const sorted = [...trips].sort((a, b) => b.id - a.id);
  return new Set(sorted.slice(FREE_TRIP_LIMIT).map((t) => t.id));
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

export interface TimelineFlight {
  id: number;
  airline: string | null;
  flight_number: string | null;
  origin: string;
  destination: string;
  departure_at: string | null;
  arrival_at: string | null;
  booking_ref: string | null;
}

export interface TimelineAccommodation {
  id: number;
  name: string;
  city: string;
  check_in: string | null;
  check_out: string | null;
  booking_ref: string | null;
}

export interface TimelineActivity {
  id: number;
  name: string;
  type: string;
  city: string | null;
  scheduled_at: string | null;
  status: string;
}

export function getTimelineData(tripId: number): {
  flights: TimelineFlight[];
  accommodations: TimelineAccommodation[];
  activities: TimelineActivity[];
} {
  const flights = db.getAllSync<TimelineFlight>(
    "SELECT id, airline, flight_number, origin, destination, departure_at, arrival_at, booking_ref FROM flights WHERE trip_id = ? ORDER BY departure_at ASC NULLS LAST",
    [tripId]
  );
  const accommodations = db.getAllSync<TimelineAccommodation>(
    "SELECT id, name, city, check_in, check_out, booking_ref FROM accommodations WHERE trip_id = ? ORDER BY check_in ASC NULLS LAST",
    [tripId]
  );
  const activities = db.getAllSync<TimelineActivity>(
    "SELECT id, name, type, city, scheduled_at, status FROM activities WHERE trip_id = ? ORDER BY scheduled_at ASC NULLS LAST",
    [tripId]
  );
  return { flights, accommodations, activities };
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
