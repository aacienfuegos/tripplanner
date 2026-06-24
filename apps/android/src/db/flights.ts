import { db } from "./database";
import type { ImportFlight } from "@tripplanner/shared";

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

export function listFlights(tripId: number): Flight[] {
  return db.getAllSync<Flight>(
    "SELECT * FROM flights WHERE trip_id = ? ORDER BY departure_at ASC, created_at ASC",
    [tripId]
  );
}

export function createFlight(
  tripId: number,
  data: Omit<Flight, "id" | "trip_id" | "created_at">
): void {
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
      data.booking_ref,
      data.confirmation_url,
      data.seat_number,
      data.class,
      data.price,
      data.notes,
    ]
  );
}

export function updateFlight(id: number, data: Omit<Flight, "id" | "trip_id" | "created_at">): void {
  db.runSync(
    `UPDATE flights SET airline=?, flight_number=?, origin=?, destination=?, departure_at=?,
     arrival_at=?, booking_ref=?, confirmation_url=?, seat_number=?, class=?, price=?, notes=?
     WHERE id=?`,
    [
      data.airline, data.flight_number, data.origin, data.destination, data.departure_at,
      data.arrival_at, data.booking_ref, data.confirmation_url, data.seat_number,
      data.class, data.price, data.notes, id,
    ]
  );
}

export function deleteFlight(id: number): void {
  db.runSync("DELETE FROM flights WHERE id = ?", [id]);
}

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
