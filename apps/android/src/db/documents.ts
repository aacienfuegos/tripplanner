import { db } from "./database";
import type { ImportDocument } from "@tripplanner/shared";

export interface Document {
  id: number;
  trip_id: number;
  name: string;
  type: "PASSPORT" | "VISA" | "INSURANCE" | "TICKET" | "VOUCHER" | "OTHER";
  expires_at: string | null;
  notes: string | null;
  created_at: string;
}

export function listDocuments(tripId: number): Document[] {
  return db.getAllSync<Document>(
    "SELECT * FROM documents WHERE trip_id = ? ORDER BY type ASC, name ASC",
    [tripId]
  );
}

export function createDocument(
  tripId: number,
  data: Omit<Document, "id" | "trip_id" | "created_at">
): void {
  db.runSync(
    `INSERT INTO documents (trip_id, name, type, expires_at, notes)
     VALUES (?, ?, ?, ?, ?)`,
    [tripId, data.name, data.type, data.expires_at, data.notes]
  );
}

export function deleteDocument(id: number): void {
  db.runSync("DELETE FROM documents WHERE id = ?", [id]);
}

export function bulkCreateDocuments(
  tripId: number,
  items: ImportDocument[]
): number {
  let count = 0;
  for (const d of items) {
    db.runSync(
      `INSERT INTO documents (trip_id, name, type, expires_at, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [tripId, d.name, d.type, d.expiresAt ?? null, d.notes ?? null]
    );
    count++;
  }
  return count;
}
