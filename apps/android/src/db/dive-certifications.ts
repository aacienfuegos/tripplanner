import { db } from "./database";

export interface DiveCertification {
  id: number;
  agency: string;
  level: string;
  cert_number: string | null;
  issue_date: string | null;
  instructor_name: string | null;
  notes: string | null;
  source: "MANUAL" | "IMPORTED";
  external_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DiveCertificationInput {
  agency: string;
  level: string;
  cert_number: string | null;
  issue_date: string | null;
  instructor_name: string | null;
  notes: string | null;
}

export function listDiveCertifications(): DiveCertification[] {
  return db.getAllSync<DiveCertification>(
    "SELECT * FROM dive_certifications ORDER BY issue_date DESC NULLS LAST"
  );
}

export function createDiveCertification(data: DiveCertificationInput): void {
  db.runSync(
    `INSERT INTO dive_certifications (agency, level, cert_number, issue_date, instructor_name, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [data.agency, data.level, data.cert_number, data.issue_date, data.instructor_name, data.notes]
  );
}

export function updateDiveCertification(id: number, data: DiveCertificationInput): void {
  db.runSync(
    `UPDATE dive_certifications SET agency=?, level=?, cert_number=?, issue_date=?, instructor_name=?,
     notes=?, updated_at=datetime('now') WHERE id=?`,
    [data.agency, data.level, data.cert_number, data.issue_date, data.instructor_name, data.notes, id]
  );
}

export function deleteDiveCertification(id: number): void {
  db.runSync("DELETE FROM dive_certifications WHERE id = ?", [id]);
}
