import { db } from "./database";
import type { ImportPackingItem } from "@tripplanner/shared";

export interface PackingItem {
  id: number;
  trip_id: number;
  name: string;
  category: string;
  quantity: number;
  packed: number; // 0 | 1
  created_at: string;
}

export function listPackingItems(tripId: number): PackingItem[] {
  return db.getAllSync<PackingItem>(
    "SELECT * FROM packing_items WHERE trip_id = ? ORDER BY category ASC, name ASC",
    [tripId]
  );
}

export function createPackingItem(
  tripId: number,
  data: Omit<PackingItem, "id" | "trip_id" | "created_at">
): void {
  db.runSync(
    `INSERT INTO packing_items (trip_id, name, category, quantity, packed)
     VALUES (?, ?, ?, ?, ?)`,
    [tripId, data.name, data.category, data.quantity, data.packed]
  );
}

export function togglePacked(id: number, packed: boolean): void {
  db.runSync("UPDATE packing_items SET packed = ? WHERE id = ?", [packed ? 1 : 0, id]);
}

export function updatePackingItem(id: number, data: Pick<PackingItem, "name" | "category" | "quantity">): void {
  db.runSync(
    "UPDATE packing_items SET name=?, category=?, quantity=? WHERE id=?",
    [data.name, data.category, data.quantity, id]
  );
}

export function deletePackingItem(id: number): void {
  db.runSync("DELETE FROM packing_items WHERE id = ?", [id]);
}

export function bulkCreatePackingItems(
  tripId: number,
  items: ImportPackingItem[]
): number {
  let count = 0;
  for (const p of items) {
    db.runSync(
      `INSERT INTO packing_items (trip_id, name, category, quantity, packed)
       VALUES (?, ?, ?, ?, 0)`,
      [tripId, p.name, p.category, p.quantity]
    );
    count++;
  }
  return count;
}
