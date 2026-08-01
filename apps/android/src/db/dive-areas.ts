import { db } from "./database";

export interface DiveArea {
  id: number;
  name: string;
  country: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function listDiveAreas(): DiveArea[] {
  return db.getAllSync<DiveArea>("SELECT * FROM dive_areas ORDER BY name ASC");
}

export function getDiveArea(id: number): DiveArea | null {
  return db.getFirstSync<DiveArea>("SELECT * FROM dive_areas WHERE id = ?", [id]) ?? null;
}

export function createDiveArea(data: { name: string; country: string | null; notes: string | null }): DiveArea {
  const result = db.runSync(
    "INSERT INTO dive_areas (name, country, notes) VALUES (?, ?, ?)",
    [data.name, data.country, data.notes]
  );
  return getDiveArea(result.lastInsertRowId)!;
}

export function updateDiveArea(id: number, data: { name: string; country: string | null; notes: string | null }): void {
  db.runSync(
    "UPDATE dive_areas SET name=?, country=?, notes=?, updated_at=datetime('now') WHERE id=?",
    [data.name, data.country, data.notes, id]
  );
}

export function deleteDiveArea(id: number): void {
  db.runSync("DELETE FROM dive_areas WHERE id = ?", [id]);
}
