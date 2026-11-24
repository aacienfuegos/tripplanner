import { db } from "./database";
import { DEFAULT_PACKING_ITEMS, foldText, type ImportPackingItem, type SuitcaseType } from "@tripplanner/shared";
import { ensureSuitcases, requireSuitcaseInTrip } from "./suitcases";

export interface PackingItem {
  id: number;
  trip_id: number;
  suitcase_id: number | null;
  name: string;
  category: string;
  quantity: number;
  packed: number; // 0 | 1
  created_at: string;
}

type PackingItemInput = Pick<PackingItem, "name" | "category" | "quantity" | "packed"> & {
  suitcase_id?: number | null;
};

export function listPackingItems(tripId: number): PackingItem[] {
  return db.getAllSync<PackingItem>(
    "SELECT * FROM packing_items WHERE trip_id = ? ORDER BY category ASC, name ASC",
    [tripId]
  );
}

export function createPackingItem(tripId: number, data: PackingItemInput): void {
  const suitcaseId = data.suitcase_id ?? null;
  requireSuitcaseInTrip(tripId, suitcaseId);
  db.runSync(
    `INSERT INTO packing_items (trip_id, suitcase_id, name, category, quantity, packed)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [tripId, suitcaseId, data.name, data.category, data.quantity, data.packed]
  );
}

export function togglePacked(id: number, packed: boolean): void {
  db.runSync("UPDATE packing_items SET packed = ? WHERE id = ?", [packed ? 1 : 0, id]);
}

// Moving an item to another bag unpacks it: it isn't in the new bag yet. SET
// reads the row as it was, and IS compares NULL ("no bag") as a value.
export function updatePackingItem(
  tripId: number,
  id: number,
  data: Pick<PackingItem, "name" | "category" | "quantity" | "suitcase_id">
): void {
  requireSuitcaseInTrip(tripId, data.suitcase_id);
  db.runSync(
    `UPDATE packing_items
     SET name = ?, category = ?, quantity = ?,
         packed = CASE WHEN suitcase_id IS ? THEN packed ELSE 0 END,
         suitcase_id = ?
     WHERE id = ? AND trip_id = ?`,
    [data.name, data.category, data.quantity, data.suitcase_id, data.suitcase_id, id, tripId]
  );
}

export function deletePackingItem(id: number): void {
  db.runSync("DELETE FROM packing_items WHERE id = ?", [id]);
}

// ─── Bulk ─────────────────────────────────────────────────────────────────────
// Every statement carries trip_id = ?: an id from another trip in the list is
// left untouched. Each one is a single statement, atomic on its own, as the
// web's updateMany/deleteMany.

const placeholders = (n: number) => Array.from({ length: n }, () => "?").join(", ");

// Only the items that actually change bag are touched (and unpacked).
// IS NOT, unlike <>, is true for NULL against a bag id, and false for NULL
// against NULL.
export function movePackingItems(tripId: number, ids: readonly number[], suitcaseId: number | null): void {
  if (ids.length === 0) return;
  requireSuitcaseInTrip(tripId, suitcaseId);
  db.runSync(
    `UPDATE packing_items SET suitcase_id = ?, packed = 0
     WHERE trip_id = ? AND suitcase_id IS NOT ? AND id IN (${placeholders(ids.length)})`,
    [suitcaseId, tripId, suitcaseId, ...ids]
  );
}

export function deletePackingItems(tripId: number, ids: readonly number[]): void {
  if (ids.length === 0) return;
  db.runSync(
    `DELETE FROM packing_items WHERE trip_id = ? AND id IN (${placeholders(ids.length)})`,
    [tripId, ...ids]
  );
}

export function setPackedPackingItems(tripId: number, ids: readonly number[], packed: boolean): void {
  if (ids.length === 0) return;
  db.runSync(
    `UPDATE packing_items SET packed = ? WHERE trip_id = ? AND id IN (${placeholders(ids.length)})`,
    [packed ? 1 : 0, tripId, ...ids]
  );
}

// undefined: the whole trip; null: the items with no bag; an id: that bag.
export function unpackAllPackingItems(tripId: number, suitcaseId?: number | null): void {
  if (suitcaseId === undefined) {
    db.runSync("UPDATE packing_items SET packed = 0 WHERE trip_id = ? AND packed = 1", [tripId]);
  } else {
    db.runSync(
      "UPDATE packing_items SET packed = 0 WHERE trip_id = ? AND suitcase_id IS ? AND packed = 1",
      [tripId, suitcaseId]
    );
  }
}

export function addDefaultPackingItems(tripId: number, suitcaseId: number | null): void {
  requireSuitcaseInTrip(tripId, suitcaseId);
  db.withTransactionSync(() => {
    for (const item of DEFAULT_PACKING_ITEMS) {
      db.runSync(
        `INSERT INTO packing_items (trip_id, suitcase_id, name, category, quantity, packed)
         VALUES (?, ?, ?, ?, 1, 0)`,
        [tripId, suitcaseId, item.name, item.category]
      );
    }
  });
}

// Copies the source trip's bags (name and type, no weight: it is what this trip
// weighs that matters) and items into this trip, unpacked. A bag whose folded
// name already exists here is reused. The source trip is only read.
export function copyPackingFromTrip(tripId: number, sourceTripId: number): { suitcases: number; items: number } {
  if (sourceTripId === tripId) throw new Error("Cannot copy a trip onto itself");
  let result = { suitcases: 0, items: 0 };
  db.withTransactionSync(() => {
    const sourceSuitcases = db.getAllSync<{ id: number; name: string; type: SuitcaseType }>(
      "SELECT id, name, type FROM suitcases WHERE trip_id = ? ORDER BY id ASC",
      [sourceTripId]
    );
    const sourceItems = db.getAllSync<Pick<PackingItem, "name" | "category" | "quantity" | "suitcase_id">>(
      "SELECT name, category, quantity, suitcase_id FROM packing_items WHERE trip_id = ? ORDER BY id ASC",
      [sourceTripId]
    );

    const { ids, created } = ensureSuitcases(tripId, sourceSuitcases);
    const nameBySourceId = new Map(sourceSuitcases.map((s) => [s.id, foldText(s.name)]));
    const targetId = (sourceSuitcaseId: number | null) => {
      const key = sourceSuitcaseId === null ? undefined : nameBySourceId.get(sourceSuitcaseId);
      return key === undefined ? null : (ids.get(key) ?? null);
    };

    for (const i of sourceItems) {
      db.runSync(
        `INSERT INTO packing_items (trip_id, suitcase_id, name, category, quantity, packed)
         VALUES (?, ?, ?, ?, ?, 0)`,
        [tripId, targetId(i.suitcase_id), i.name, i.category, i.quantity]
      );
    }
    result = { suitcases: created, items: sourceItems.length };
  });
  return result;
}

// The other trips with something to copy, most recent first.
export function listTripsWithPacking(excludeTripId: number): { id: number; name: string }[] {
  return db.getAllSync<{ id: number; name: string }>(
    `SELECT id, name FROM trips
     WHERE id <> ?
       AND (EXISTS (SELECT 1 FROM packing_items WHERE trip_id = trips.id)
         OR EXISTS (SELECT 1 FROM suitcases WHERE trip_id = trips.id))
     ORDER BY created_at DESC`,
    [excludeTripId]
  );
}

// Runs inside bulkImport's transaction. Bags are matched by folded name, and
// the missing ones are created once each, type Other and without weight.
export function bulkCreatePackingItems(
  tripId: number,
  items: ImportPackingItem[]
): number {
  const { ids } = ensureSuitcases(
    tripId,
    items.map((p) => ({ name: p.suitcase, type: "OTHER" as const }))
  );
  let count = 0;
  for (const p of items) {
    db.runSync(
      `INSERT INTO packing_items (trip_id, suitcase_id, name, category, quantity, packed)
       VALUES (?, ?, ?, ?, ?, 0)`,
      [tripId, p.suitcase ? (ids.get(foldText(p.suitcase)) ?? null) : null, p.name, p.category, p.quantity]
    );
    count++;
  }
  return count;
}
