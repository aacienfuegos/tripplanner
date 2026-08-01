import { db } from "./database";
import type { ImportFlight } from "@tripplanner/shared";
import { encryptText, decryptText } from "@/crypto/fieldEncryption";

export interface Flight {
  id: number;
  trip_id: number;
  airline: string | null;
  flight_number: string | null;
  origin: string;
  destination: string;
  departure_at: string | null;
  arrival_at: string | null;
  booking_ref: string | null;
  confirmation_url: string | null;
  seat_number: string | null;
  class: "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST";
  price: number | null;
  notes: string | null;
  created_at: string;
}

async function decryptRow(row: Flight): Promise<Flight> {
  return {
    ...row,
    booking_ref: row.booking_ref ? await decryptText(row.booking_ref) : null,
    confirmation_url: row.confirmation_url ? await decryptText(row.confirmation_url) : null,
    notes: row.notes ? await decryptText(row.notes) : null,
  };
}

export async function listFlights(tripId: number): Promise<Flight[]> {
  const rows = db.getAllSync<Flight>(
    "SELECT * FROM flights WHERE trip_id = ? ORDER BY departure_at ASC, created_at ASC",
    [tripId]
  );
  return Promise.all(rows.map(decryptRow));
}

export async function createFlight(
  tripId: number,
  data: Omit<Flight, "id" | "trip_id" | "created_at">
): Promise<void> {
  const bookingRef = data.booking_ref ? await encryptText(data.booking_ref) : null;
  const confirmationUrl = data.confirmation_url ? await encryptText(data.confirmation_url) : null;
  const notes = data.notes ? await encryptText(data.notes) : null;
  db.runSync(
    `INSERT INTO flights
       (trip_id, airline, flight_number, origin, destination, departure_at,
        arrival_at, booking_ref, confirmation_url, seat_number, class, price, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tripId,
      data.airline,
      data.flight_number,
      data.origin,
      data.destination,
      data.departure_at,
      data.arrival_at,
      bookingRef,
      confirmationUrl,
      data.seat_number,
      data.class,
      data.price,
      notes,
    ]
  );
}

export async function updateFlight(id: number, data: Omit<Flight, "id" | "trip_id" | "created_at">): Promise<void> {
  const bookingRef = data.booking_ref ? await encryptText(data.booking_ref) : null;
  const confirmationUrl = data.confirmation_url ? await encryptText(data.confirmation_url) : null;
  const notes = data.notes ? await encryptText(data.notes) : null;
  db.runSync(
    `UPDATE flights SET airline=?, flight_number=?, origin=?, destination=?, departure_at=?,
     arrival_at=?, booking_ref=?, confirmation_url=?, seat_number=?, class=?, price=?, notes=?
     WHERE id=?`,
    [
      data.airline, data.flight_number, data.origin, data.destination, data.departure_at,
      data.arrival_at, bookingRef, confirmationUrl, data.seat_number,
      data.class, data.price, notes, id,
    ]
  );
}

export function deleteFlight(id: number): void {
  db.runSync("DELETE FROM flights WHERE id = ?", [id]);
}

// Cifra booking_ref/confirmation_url/notes por adelantado para poder
// insertarlos dentro de una transacción síncrona (expo-sqlite no admite
// await en withTransactionSync).
export async function encryptImportFlights(items: ImportFlight[]): Promise<ImportFlight[]> {
  return Promise.all(
    items.map(async (f) => ({
      ...f,
      bookingRef: f.bookingRef ? await encryptText(f.bookingRef) : f.bookingRef,
      confirmationUrl: f.confirmationUrl ? await encryptText(f.confirmationUrl) : f.confirmationUrl,
      notes: f.notes ? await encryptText(f.notes) : f.notes,
    }))
  );
}

// Espera items ya cifrados vía encryptImportFlights().
export function bulkCreateFlights(tripId: number, items: ImportFlight[]): number {
  let count = 0;
  for (const f of items) {
    db.runSync(
      `INSERT INTO flights
         (trip_id, airline, flight_number, origin, destination, departure_at,
          arrival_at, booking_ref, confirmation_url, seat_number, class, price, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tripId,
        f.airline ?? null,
        f.flightNumber ?? null,
        f.origin,
        f.destination,
        f.departureAt ?? null,
        f.arrivalAt ?? null,
        f.bookingRef ?? null,
        f.confirmationUrl ?? null,
        f.seatNumber ?? null,
        f.class,
        f.price ?? null,
        f.notes ?? null,
      ]
    );
    count++;
  }
  return count;
}
