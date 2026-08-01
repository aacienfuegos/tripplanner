import { db } from "./database";
import type { ImportDocument } from "@tripplanner/shared";
import { encryptText, decryptText } from "@/crypto/documentEncryption";

export interface Document {
  id: number;
  trip_id: number;
  name: string;
  type: "PASSPORT" | "VISA" | "INSURANCE" | "TICKET" | "VOUCHER" | "OTHER";
  expires_at: string | null;
  notes: string | null;
  created_at: string;
}

async function decryptRow(row: Document): Promise<Document> {
  return {
    ...row,
    name: await decryptText(row.name),
    notes: row.notes ? await decryptText(row.notes) : null,
  };
}

export async function listDocuments(tripId: number): Promise<Document[]> {
  const rows = db.getAllSync<Document>(
    "SELECT * FROM documents WHERE trip_id = ?",
    [tripId]
  );
  const docs = await Promise.all(rows.map(decryptRow));
  return docs.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
}

export async function createDocument(
  tripId: number,
  data: Omit<Document, "id" | "trip_id" | "created_at">
): Promise<void> {
  const name = await encryptText(data.name);
  const notes = data.notes ? await encryptText(data.notes) : null;
  db.runSync(
    `INSERT INTO documents (trip_id, name, type, expires_at, notes)
     VALUES (?, ?, ?, ?, ?)`,
    [tripId, name, data.type, data.expires_at, notes]
  );
}

export async function updateDocument(
  id: number,
  data: Omit<Document, "id" | "trip_id" | "created_at">
): Promise<void> {
  const name = await encryptText(data.name);
  const notes = data.notes ? await encryptText(data.notes) : null;
  db.runSync(
    "UPDATE documents SET name=?, type=?, expires_at=?, notes=? WHERE id=?",
    [name, data.type, data.expires_at, notes, id]
  );
}

export function deleteDocument(id: number): void {
  db.runSync("DELETE FROM documents WHERE id = ?", [id]);
}

// Cifra name/notes por adelantado para poder insertarlos dentro de una
// transacción síncrona (expo-sqlite no admite await en withTransactionSync).
export async function encryptImportDocuments(items: ImportDocument[]): Promise<ImportDocument[]> {
  return Promise.all(
    items.map(async (d) => ({
      ...d,
      name: await encryptText(d.name),
      notes: d.notes ? await encryptText(d.notes) : d.notes,
    }))
  );
}

// Espera items ya cifrados vía encryptImportDocuments() — se llama dentro de
// una transacción síncrona, así que no puede cifrar aquí mismo.
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
