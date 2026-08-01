import { db } from "./database";

export interface DiveSite {
  id: number;
  dive_area_id: number | null;
  name: string;
  address: string | null;
  country: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  source: "MANUAL" | "IMPORTED";
  external_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DiveSiteInput {
  dive_area_id: number | null;
  name: string;
  address: string | null;
  country: string | null;
  region: string | null;
  notes: string | null;
}

export function listDiveSites(): DiveSite[] {
  return db.getAllSync<DiveSite>("SELECT * FROM dive_sites ORDER BY name ASC");
}

export function listDiveSitesByArea(diveAreaId: number): DiveSite[] {
  return db.getAllSync<DiveSite>(
    "SELECT * FROM dive_sites WHERE dive_area_id = ? ORDER BY name ASC",
    [diveAreaId]
  );
}

export function getDiveSite(id: number): DiveSite | null {
  return db.getFirstSync<DiveSite>("SELECT * FROM dive_sites WHERE id = ?", [id]) ?? null;
}

export function createDiveSite(data: DiveSiteInput): DiveSite {
  const result = db.runSync(
    `INSERT INTO dive_sites (dive_area_id, name, address, country, region, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [data.dive_area_id, data.name, data.address, data.country, data.region, data.notes]
  );
  return getDiveSite(result.lastInsertRowId)!;
}

export function updateDiveSite(id: number, data: DiveSiteInput): void {
  db.runSync(
    `UPDATE dive_sites SET dive_area_id=?, name=?, address=?, country=?, region=?, notes=?,
     updated_at=datetime('now') WHERE id=?`,
    [data.dive_area_id, data.name, data.address, data.country, data.region, data.notes, id]
  );
}

export function deleteDiveSite(id: number): void {
  db.runSync("DELETE FROM dive_sites WHERE id = ?", [id]);
}
