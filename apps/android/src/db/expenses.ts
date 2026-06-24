import { db } from "./database";
import type { ImportExpense } from "@tripplanner/shared";

export interface Expense {
  id: number;
  trip_id: number;
  description: string;
  category: "FLIGHT" | "ACCOMMODATION" | "FOOD" | "TRANSPORT" | "ACTIVITY" | "SHOPPING" | "OTHER";
  amount: number;
  currency: string;
  date: string;
  paid: number; // SQLite stores booleans as 0/1
  notes: string | null;
  created_at: string;
}

export function listExpenses(tripId: number): Expense[] {
  return db.getAllSync<Expense>(
    "SELECT * FROM expenses WHERE trip_id = ? ORDER BY date ASC, created_at ASC",
    [tripId]
  );
}

export function createExpense(
  tripId: number,
  data: Omit<Expense, "id" | "trip_id" | "created_at">
): void {
  db.runSync(
    `INSERT INTO expenses (trip_id, description, category, amount, currency, date, paid, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tripId, data.description, data.category, data.amount,
      data.currency, data.date, data.paid, data.notes,
    ]
  );
}

export function toggleExpensePaid(id: number, paid: boolean): void {
  db.runSync("UPDATE expenses SET paid = ? WHERE id = ?", [paid ? 1 : 0, id]);
}

export function deleteExpense(id: number): void {
  db.runSync("DELETE FROM expenses WHERE id = ?", [id]);
}

export function bulkCreateExpenses(
  tripId: number,
  items: ImportExpense[]
): number {
  let count = 0;
  for (const e of items) {
    db.runSync(
      `INSERT INTO expenses (trip_id, description, category, amount, currency, date, paid, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tripId, e.description, e.category, e.amount,
        e.currency, e.date, e.paid ? 1 : 0, e.notes ?? null,
      ]
    );
    count++;
  }
  return count;
}

export function sumExpenses(tripId: number, currency: string): number {
  const row = db.getFirstSync<{ total: number | null }>(
    "SELECT SUM(amount) as total FROM expenses WHERE trip_id = ? AND currency = ?",
    [tripId, currency]
  );
  return row?.total ?? 0;
}
