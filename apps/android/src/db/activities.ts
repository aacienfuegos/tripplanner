import { db } from "./database";
import type { ImportActivity } from "@tripplanner/shared";
import { encryptText, decryptText } from "@/crypto/fieldEncryption";

export interface Activity {
  id: number;
  trip_id: number;
  name: string;
  type: "ACTIVITY" | "RESTAURANT" | "MUSEUM" | "TOUR" | "TRANSPORT" | "SHOW" | "OTHER";
  description: string | null;
  location: string | null;
  city: string | null;
  scheduled_at: string | null;
  duration: number | null;
  booking_ref: string | null;
  confirmation_url: string | null;
  price: number | null;
  status: "PENDING" | "RESERVED" | "CONFIRMED" | "CANCELLED";
  notes: string | null;
  created_at: string;
}

async function decryptRow(row: Activity): Promise<Activity> {
  return {
    ...row,
    booking_ref: row.booking_ref ? await decryptText(row.booking_ref) : null,
    confirmation_url: row.confirmation_url ? await decryptText(row.confirmation_url) : null,
    notes: row.notes ? await decryptText(row.notes) : null,
  };
}

export async function listActivities(tripId: number): Promise<Activity[]> {
  const rows = db.getAllSync<Activity>(
    "SELECT * FROM activities WHERE trip_id = ? ORDER BY scheduled_at ASC, created_at ASC",
    [tripId]
  );
  return Promise.all(rows.map(decryptRow));
}

export async function createActivity(
  tripId: number,
  data: Omit<Activity, "id" | "trip_id" | "created_at">
): Promise<void> {
  const bookingRef = data.booking_ref ? await encryptText(data.booking_ref) : null;
  const confirmationUrl = data.confirmation_url ? await encryptText(data.confirmation_url) : null;
  const notes = data.notes ? await encryptText(data.notes) : null;
  db.runSync(
    `INSERT INTO activities
       (trip_id, name, type, description, location, city, scheduled_at,
        duration, booking_ref, confirmation_url, price, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tripId, data.name, data.type, data.description, data.location, data.city,
      data.scheduled_at, data.duration, bookingRef, confirmationUrl,
      data.price, data.status, notes,
    ]
  );
}

export async function updateActivity(
  id: number,
  data: Omit<Activity, "id" | "trip_id" | "created_at">
): Promise<void> {
  const bookingRef = data.booking_ref ? await encryptText(data.booking_ref) : null;
  const confirmationUrl = data.confirmation_url ? await encryptText(data.confirmation_url) : null;
  const notes = data.notes ? await encryptText(data.notes) : null;
  db.runSync(
    `UPDATE activities SET name=?, type=?, description=?, location=?, city=?, scheduled_at=?,
     duration=?, booking_ref=?, confirmation_url=?, price=?, status=?, notes=? WHERE id=?`,
    [
      data.name, data.type, data.description, data.location, data.city, data.scheduled_at,
      data.duration, bookingRef, confirmationUrl, data.price, data.status, notes, id,
    ]
  );
}

export function deleteActivity(id: number): void {
  db.runSync("DELETE FROM activities WHERE id = ?", [id]);
}

export async function encryptImportActivities(items: ImportActivity[]): Promise<ImportActivity[]> {
  return Promise.all(
    items.map(async (a) => ({
      ...a,
      bookingRef: a.bookingRef ? await encryptText(a.bookingRef) : a.bookingRef,
      confirmationUrl: a.confirmationUrl ? await encryptText(a.confirmationUrl) : a.confirmationUrl,
      notes: a.notes ? await encryptText(a.notes) : a.notes,
    }))
  );
}

// Espera items ya cifrados vía encryptImportActivities().
export function bulkCreateActivities(
  tripId: number,
  items: ImportActivity[]
): number {
  let count = 0;
  for (const a of items) {
    db.runSync(
      `INSERT INTO activities
         (trip_id, name, type, description, location, city, scheduled_at,
          duration, booking_ref, confirmation_url, price, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tripId, a.name, a.type, a.description ?? null, a.location ?? null,
        a.city ?? null, a.scheduledAt ?? null, a.duration ?? null,
        a.bookingRef ?? null, a.confirmationUrl ?? null, a.price ?? null,
        a.status, a.notes ?? null,
      ]
    );
    count++;
  }
  return count;
}
