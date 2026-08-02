import { db } from "./database";

export interface DiveLog {
  id: number;
  trip_id: number | null;
  dive_site_id: number | null;
  date: string;
  dive_number: number;
  depth_max: number;
  bottom_time: number;
  surface_interval: number | null;
  gas_mix: "AIR" | "NITROX" | "TRIMIX" | "OXYGEN";
  o2_percentage: number | null;
  helium_percentage: number | null;
  pressure_start: number | null;
  pressure_end: number | null;
  water_temp: number | null;
  air_temp: number | null;
  visibility: number | null;
  dive_type: string | null;
  buddy_name: string | null;
  suit_type: string | null;
  weight: number | null;
  notes: string | null;
  rating: number | null;
  source: "MANUAL" | "IMPORTED";
  external_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DiveLogInput {
  trip_id: number | null;
  dive_site_id: number | null;
  date: string;
  depth_max: number;
  bottom_time: number;
  surface_interval: number | null;
  gas_mix: DiveLog["gas_mix"];
  o2_percentage: number | null;
  helium_percentage: number | null;
  pressure_start: number | null;
  pressure_end: number | null;
  water_temp: number | null;
  air_temp: number | null;
  visibility: number | null;
  dive_type: string | null;
  buddy_name: string | null;
  suit_type: string | null;
  weight: number | null;
  notes: string | null;
  rating: number | null;
  equipmentIds: number[];
}

// diveNumber refleja la posición cronológica real (la Nª inmersión es la Nª
// por fecha), no el orden de registro — se recalcula entero cada vez que
// cambia el conjunto de inmersiones, igual que en la web (dive-numbering.ts).
function renumberDives(): void {
  const dives = db.getAllSync<{ id: number; dive_number: number }>(
    "SELECT id, dive_number FROM dive_logs ORDER BY date ASC"
  );
  dives.forEach((d, i) => {
    const newNumber = i + 1;
    if (d.dive_number !== newNumber) {
      db.runSync("UPDATE dive_logs SET dive_number = ? WHERE id = ?", [newNumber, d.id]);
    }
  });
}

function setEquipment(diveLogId: number, equipmentIds: number[]): void {
  db.runSync("DELETE FROM dive_log_equipment WHERE dive_log_id = ?", [diveLogId]);
  for (const equipmentId of equipmentIds) {
    db.runSync(
      "INSERT INTO dive_log_equipment (dive_log_id, equipment_id) VALUES (?, ?)",
      [diveLogId, equipmentId]
    );
  }
}

export function listDiveLogEquipmentIds(diveLogId: number): number[] {
  return db
    .getAllSync<{ equipment_id: number }>(
      "SELECT equipment_id FROM dive_log_equipment WHERE dive_log_id = ?",
      [diveLogId]
    )
    .map((r) => r.equipment_id);
}

export function listDiveLogs(): DiveLog[] {
  return db.getAllSync<DiveLog>("SELECT * FROM dive_logs ORDER BY date DESC");
}

export function listDiveLogsForTrip(tripId: number): DiveLog[] {
  return db.getAllSync<DiveLog>(
    "SELECT * FROM dive_logs WHERE trip_id = ? ORDER BY date ASC",
    [tripId]
  );
}

export function listDiveLogsForSite(diveSiteId: number): DiveLog[] {
  return db.getAllSync<DiveLog>(
    "SELECT * FROM dive_logs WHERE dive_site_id = ? ORDER BY date DESC",
    [diveSiteId]
  );
}

export interface DiveStatsRow {
  depthMax: number;
  bottomTime: number;
  waterTemp: number | null;
  date: string;
  diveSite: { id: number; name: string; country: string | null } | null;
}

// Para computeDiveStats() (src/lib/dive-stats.ts) — join con dive_sites para
// tener nombre/país sin una query aparte por cada inmersión.
export function listDiveStatsRows(): DiveStatsRow[] {
  const rows = db.getAllSync<{
    depth_max: number; bottom_time: number; water_temp: number | null; date: string;
    site_id: number | null; site_name: string | null; site_country: string | null;
  }>(
    `SELECT dl.depth_max, dl.bottom_time, dl.water_temp, dl.date,
            ds.id as site_id, ds.name as site_name, ds.country as site_country
     FROM dive_logs dl
     LEFT JOIN dive_sites ds ON ds.id = dl.dive_site_id`
  );
  return rows.map((r) => ({
    depthMax: r.depth_max,
    bottomTime: r.bottom_time,
    waterTemp: r.water_temp,
    date: r.date,
    diveSite: r.site_id != null ? { id: r.site_id, name: r.site_name!, country: r.site_country } : null,
  }));
}

export function getDiveLog(id: number): DiveLog | null {
  return db.getFirstSync<DiveLog>("SELECT * FROM dive_logs WHERE id = ?", [id]) ?? null;
}

export function createDiveLog(data: DiveLogInput): void {
  const result = db.runSync(
    `INSERT INTO dive_logs
       (trip_id, dive_site_id, date, dive_number, depth_max, bottom_time, surface_interval,
        gas_mix, o2_percentage, helium_percentage, pressure_start, pressure_end, water_temp,
        air_temp, visibility, dive_type, buddy_name, suit_type, weight, notes, rating)
     VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.trip_id, data.dive_site_id, data.date, data.depth_max, data.bottom_time,
      data.surface_interval, data.gas_mix, data.o2_percentage, data.helium_percentage,
      data.pressure_start, data.pressure_end, data.water_temp, data.air_temp, data.visibility,
      data.dive_type, data.buddy_name, data.suit_type, data.weight, data.notes, data.rating,
    ]
  );
  setEquipment(result.lastInsertRowId, data.equipmentIds);
  renumberDives();
}

export function updateDiveLog(id: number, data: DiveLogInput): void {
  db.runSync(
    `UPDATE dive_logs SET trip_id=?, dive_site_id=?, date=?, depth_max=?, bottom_time=?,
     surface_interval=?, gas_mix=?, o2_percentage=?, helium_percentage=?, pressure_start=?,
     pressure_end=?, water_temp=?, air_temp=?, visibility=?, dive_type=?, buddy_name=?,
     suit_type=?, weight=?, notes=?, rating=?, updated_at=datetime('now') WHERE id=?`,
    [
      data.trip_id, data.dive_site_id, data.date, data.depth_max, data.bottom_time,
      data.surface_interval, data.gas_mix, data.o2_percentage, data.helium_percentage,
      data.pressure_start, data.pressure_end, data.water_temp, data.air_temp, data.visibility,
      data.dive_type, data.buddy_name, data.suit_type, data.weight, data.notes, data.rating, id,
    ]
  );
  setEquipment(id, data.equipmentIds);
  // La edición puede haber cambiado la fecha, así que reordena por si afecta
  // a la posición cronológica de esta u otras inmersiones.
  renumberDives();
}

export function deleteDiveLog(id: number): void {
  db.runSync("DELETE FROM dive_logs WHERE id = ?", [id]);
  renumberDives();
}

export function linkDiveToTrip(diveId: number, tripId: number): void {
  db.runSync("UPDATE dive_logs SET trip_id = ? WHERE id = ?", [tripId, diveId]);
}

export function unlinkDiveFromTrip(diveId: number): void {
  db.runSync("UPDATE dive_logs SET trip_id = NULL WHERE id = ?", [diveId]);
}
