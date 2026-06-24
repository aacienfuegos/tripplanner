import { db } from "./database";
import type { ImportAccommodation } from "@tripplanner/shared";

export interface Accommodation {
  id: number;
  trip_id: number;
  name: string;
  type: "HOTEL" | "HOSTEL" | "AIRBNB" | "APARTMENT" | "RESORT" | "OTHER";
  address: string | null;
  city: string;
  check_in: string | null;
  check_out: string | null;
  booking_ref: string | null;
  confirmation_url: string | null;
  price: number | null;
  price_per_night: number | null;
  notes: string | null;
  created_at: string;
}

export function listAccommodations(tripId: number): Accommodation[] {
  return db.getAllSync<Accommodation>(
    "SELECT * FROM accommodations WHERE trip_id = ? ORDER BY check_in ASC, created_at ASC",
    [tripId]
  );
}

export function createAccommodation(
  tripId: number,
  data: Omit<Accommodation, "id" | "trip_id" | "created_at">
): void {
  db.runSync(
    `INSERT INTO accommodations
       (trip_id, name, type, address, city, check_in, check_out,
        booking_ref, confirmation_url, price, price_per_night, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tripId, data.name, data.type, data.address, data.city,
      data.check_in, data.check_out, data.booking_ref, data.confirmation_url,
      data.price, data.price_per_night, data.notes,
    ]
  );
}

export function updateAccommodation(id: number, data: Omit<Accommodation, "id" | "trip_id" | "created_at">): void {
  db.runSync(
    `UPDATE accommodations SET name=?, type=?, address=?, city=?, check_in=?, check_out=?,
     booking_ref=?, confirmation_url=?, price=?, price_per_night=?, notes=? WHERE id=?`,
    [
      data.name, data.type, data.address, data.city, data.check_in, data.check_out,
      data.booking_ref, data.confirmation_url, data.price, data.price_per_night, data.notes, id,
    ]
  );
}

export function deleteAccommodation(id: number): void {
  db.runSync("DELETE FROM accommodations WHERE id = ?", [id]);
}

export function bulkCreateAccommodations(
  tripId: number,
  items: ImportAccommodation[]
): number {
  let count = 0;
  for (const a of items) {
    db.runSync(
      `INSERT INTO accommodations
         (trip_id, name, type, address, city, check_in, check_out,
          booking_ref, confirmation_url, price, price_per_night, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tripId, a.name, a.type, a.address ?? null, a.city,
        a.checkIn ?? null, a.checkOut ?? null, a.bookingRef ?? null,
        a.confirmationUrl ?? null, a.price ?? null, a.pricePerNight ?? null,
        a.notes ?? null,
      ]
    );
    count++;
  }
  return count;
}
