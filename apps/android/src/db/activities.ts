import { db } from "./database";
import type { ImportActivity } from "@tripplanner/shared";

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

export function listActivities(tripId: number): Activity[] {
  return db.getAllSync<Activity>(
    "SELECT * FROM activities WHERE trip_id = ? ORDER BY scheduled_at ASC, created_at ASC",
    [tripId]
  );
}

export function createActivity(
  tripId: number,
  data: Omit<Activity, "id" | "trip_id" | "created_at">
): void {
  db.runSync(
    `INSERT INTO activities
       (trip_id, name, type, description, location, city, scheduled_at,
        duration, booking_ref, confirmation_url, price, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tripId, data.name, data.type, data.description, data.location, data.city,
      data.scheduled_at, data.duration, data.booking_ref, data.confirmation_url,
      data.price, data.status, data.notes,
    ]
  );
}

export function deleteActivity(id: number): void {
  db.runSync("DELETE FROM activities WHERE id = ?", [id]);
}

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
