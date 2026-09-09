import { db } from "./database";

export type EquipmentCategory =
  | "WETSUIT" | "BCD" | "REGULATOR" | "COMPUTER" | "FINS" | "MASK"
  | "TANK" | "WEIGHT" | "TORCH" | "CAMERA" | "OTHER";
export type EquipmentStatus = "OWNED" | "WISHLIST" | "RETIRED" | "SOLD";

export interface DiveEquipment {
  id: number;
  name: string;
  category: EquipmentCategory;
  brand: string | null;
  model: string | null;
  size: string | null;
  serial_number: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  status: EquipmentStatus;
  last_service_date: string | null;
  service_interval_months: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DiveEquipmentInput {
  name: string;
  category: EquipmentCategory;
  status: EquipmentStatus;
  brand: string | null;
  model: string | null;
  size: string | null;
  serial_number: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  last_service_date: string | null;
  service_interval_months: number | null;
  notes: string | null;
}

export interface DiveEquipmentService {
  id: number;
  equipment_id: number;
  date: string;
  description: string;
  cost: number | null;
  notes: string | null;
  created_at: string;
}

export function listDiveEquipment(): DiveEquipment[] {
  return db.getAllSync<DiveEquipment>("SELECT * FROM dive_equipment ORDER BY name ASC");
}

export function getDiveEquipment(id: number): DiveEquipment | null {
  return db.getFirstSync<DiveEquipment>("SELECT * FROM dive_equipment WHERE id = ?", [id]) ?? null;
}

export function countDiveLogsUsingEquipment(equipmentId: number): number {
  const row = db.getFirstSync<{ n: number }>(
    "SELECT COUNT(*) as n FROM dive_log_equipment WHERE equipment_id = ?",
    [equipmentId]
  );
  return row?.n ?? 0;
}

export function createDiveEquipment(data: DiveEquipmentInput): DiveEquipment {
  const result = db.runSync(
    `INSERT INTO dive_equipment
       (name, category, brand, model, size, serial_number, purchase_date, purchase_price,
        status, last_service_date, service_interval_months, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.name, data.category, data.brand, data.model, data.size, data.serial_number,
      data.purchase_date, data.purchase_price, data.status, data.last_service_date,
      data.service_interval_months, data.notes,
    ]
  );
  return getDiveEquipment(result.lastInsertRowId)!;
}

export function updateDiveEquipment(id: number, data: DiveEquipmentInput): void {
  db.runSync(
    `UPDATE dive_equipment SET name=?, category=?, brand=?, model=?, size=?, serial_number=?,
     purchase_date=?, purchase_price=?, status=?, last_service_date=?, service_interval_months=?,
     notes=?, updated_at=datetime('now') WHERE id=?`,
    [
      data.name, data.category, data.brand, data.model, data.size, data.serial_number,
      data.purchase_date, data.purchase_price, data.status, data.last_service_date,
      data.service_interval_months, data.notes, id,
    ]
  );
}

export function deleteDiveEquipment(id: number): void {
  db.runSync("DELETE FROM dive_equipment WHERE id = ?", [id]);
}

export function listEquipmentService(equipmentId: number): DiveEquipmentService[] {
  return db.getAllSync<DiveEquipmentService>(
    "SELECT * FROM dive_equipment_service WHERE equipment_id = ? ORDER BY date DESC",
    [equipmentId]
  );
}

// last_service_date/service_interval_months de dive_equipment son campos
// manuales del formulario del equipo (equipment-form en la web), no se
// derivan de este historial — igual que en la web.
export function createEquipmentService(
  equipmentId: number,
  data: { date: string; description: string; cost: number | null; notes: string | null }
): void {
  db.runSync(
    "INSERT INTO dive_equipment_service (equipment_id, date, description, cost, notes) VALUES (?, ?, ?, ?, ?)",
    [equipmentId, data.date, data.description, data.cost, data.notes]
  );
}

export function deleteEquipmentService(id: number): void {
  db.runSync("DELETE FROM dive_equipment_service WHERE id = ?", [id]);
}
