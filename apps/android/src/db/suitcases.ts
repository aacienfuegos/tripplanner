import { db } from "./database";
import { foldText, resolveSuitcaseNames, type SuitcaseType } from "@tripplanner/shared";

export interface Suitcase {
  id: number;
  trip_id: number;
  name: string;
  type: SuitcaseType;
  weight_grams: number | null;
  created_at: string;
}

export type SuitcaseInput = Pick<Suitcase, "name" | "type" | "weight_grams">;

// created_at only has one-second resolution, so creation order is the id.
export function listSuitcases(tripId: number): Suitcase[] {
  return db.getAllSync<Suitcase>(
    "SELECT * FROM suitcases WHERE trip_id = ? ORDER BY id ASC",
    [tripId]
  );
}

export function createSuitcase(tripId: number, data: SuitcaseInput): number {
  const result = db.runSync(
    "INSERT INTO suitcases (trip_id, name, type, weight_grams) VALUES (?, ?, ?, ?)",
    [tripId, data.name, data.type, data.weight_grams]
  );
  return result.lastInsertRowId;
}

export function updateSuitcase(tripId: number, id: number, data: SuitcaseInput): void {
  db.runSync(
    "UPDATE suitcases SET name = ?, type = ?, weight_grams = ? WHERE id = ? AND trip_id = ?",
    [data.name, data.type, data.weight_grams, id, tripId]
  );
}

// "unassign" leaves the bag's items in "no bag", unpacked: they are no longer
// in any bag. "deleteItems" deletes them along with the bag.
export function deleteSuitcase(tripId: number, id: number, mode: "unassign" | "deleteItems"): void {
  db.withTransactionSync(() => {
    if (mode === "unassign") {
      db.runSync(
        "UPDATE packing_items SET suitcase_id = NULL, packed = 0 WHERE suitcase_id = ? AND trip_id = ?",
        [id, tripId]
      );
    } else {
      db.runSync("DELETE FROM packing_items WHERE suitcase_id = ? AND trip_id = ?", [id, tripId]);
    }
    db.runSync("DELETE FROM suitcases WHERE id = ? AND trip_id = ?", [id, tripId]);
  });
}

// The foreign key only says the bag exists; that it belongs to the item's trip
// is up to the writes, as in the web's requireSuitcaseInTrip.
export function requireSuitcaseInTrip(tripId: number, suitcaseId: number | null): void {
  if (suitcaseId === null) return;
  const row = db.getFirstSync<{ id: number }>(
    "SELECT id FROM suitcases WHERE id = ? AND trip_id = ?",
    [suitcaseId, tripId]
  );
  if (!row) throw new Error("Suitcase not found in this trip");
}

// Port of apps/web/src/lib/suitcases.ts, for the AI import and "copy from
// another trip": reuses the trip's bags whose name matches by foldText and
// creates the missing ones, without weight. Call it inside a transaction.
export function ensureSuitcases(
  tripId: number,
  wanted: readonly { readonly name: string | null | undefined; readonly type: SuitcaseType }[]
): { ids: Map<string, number>; created: number } {
  const existing = db.getAllSync<{ id: number; name: string }>(
    "SELECT id, name FROM suitcases WHERE trip_id = ? ORDER BY id ASC",
    [tripId]
  );
  const { matched, toCreate } = resolveSuitcaseNames(existing, wanted.map((w) => w.name));

  const typeByKey = new Map<string, SuitcaseType>();
  for (const w of wanted) {
    const key = foldText(w.name ?? "");
    if (!typeByKey.has(key)) typeByKey.set(key, w.type);
  }
  const ids = new Map(matched);
  for (const name of toCreate) {
    const key = foldText(name);
    ids.set(key, createSuitcase(tripId, { name, type: typeByKey.get(key) ?? "OTHER", weight_grams: null }));
  }
  return { ids, created: toCreate.length };
}
