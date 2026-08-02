import { db } from "./database";
import type { ImportAccommodation } from "@tripplanner/shared";
import { encryptText, decryptText } from "@/crypto/fieldEncryption";

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
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  created_at: string;
}

async function decryptRow(row: Accommodation): Promise<Accommodation> {
  return {
    ...row,
    booking_ref: row.booking_ref ? await decryptText(row.booking_ref) : null,
    confirmation_url: row.confirmation_url ? await decryptText(row.confirmation_url) : null,
    notes: row.notes ? await decryptText(row.notes) : null,
  };
}

export async function listAccommodations(tripId: number): Promise<Accommodation[]> {
  const rows = db.getAllSync<Accommodation>(
    "SELECT * FROM accommodations WHERE trip_id = ? ORDER BY check_in ASC, created_at ASC",
    [tripId]
  );
  return Promise.all(rows.map(decryptRow));
}

export async function createAccommodation(
  tripId: number,
  data: Omit<Accommodation, "id" | "trip_id" | "created_at">
): Promise<void> {
  const bookingRef = data.booking_ref ? await encryptText(data.booking_ref) : null;
  const confirmationUrl = data.confirmation_url ? await encryptText(data.confirmation_url) : null;
  const notes = data.notes ? await encryptText(data.notes) : null;
  db.runSync(
    `INSERT INTO accommodations
       (trip_id, name, type, address, city, check_in, check_out,
        booking_ref, confirmation_url, price, price_per_night, latitude, longitude, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tripId, data.name, data.type, data.address, data.city,
      data.check_in, data.check_out, bookingRef, confirmationUrl,
      data.price, data.price_per_night, data.latitude, data.longitude, notes,
    ]
  );
}

export async function updateAccommodation(
  id: number,
  data: Omit<Accommodation, "id" | "trip_id" | "created_at">
): Promise<void> {
  const bookingRef = data.booking_ref ? await encryptText(data.booking_ref) : null;
  const confirmationUrl = data.confirmation_url ? await encryptText(data.confirmation_url) : null;
  const notes = data.notes ? await encryptText(data.notes) : null;
  db.runSync(
    `UPDATE accommodations SET name=?, type=?, address=?, city=?, check_in=?, check_out=?,
     booking_ref=?, confirmation_url=?, price=?, price_per_night=?, latitude=?, longitude=?, notes=? WHERE id=?`,
    [
      data.name, data.type, data.address, data.city, data.check_in, data.check_out,
      bookingRef, confirmationUrl, data.price, data.price_per_night,
      data.latitude, data.longitude, notes, id,
    ]
  );
}

export function deleteAccommodation(id: number): void {
  db.runSync("DELETE FROM accommodations WHERE id = ?", [id]);
}

export async function encryptImportAccommodations(
  items: ImportAccommodation[]
): Promise<ImportAccommodation[]> {
  return Promise.all(
    items.map(async (a) => ({
      ...a,
      bookingRef: a.bookingRef ? await encryptText(a.bookingRef) : a.bookingRef,
      confirmationUrl: a.confirmationUrl ? await encryptText(a.confirmationUrl) : a.confirmationUrl,
      notes: a.notes ? await encryptText(a.notes) : a.notes,
    }))
  );
}

// Espera items ya cifrados vía encryptImportAccommodations().
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
