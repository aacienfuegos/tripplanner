import { db } from "./database";

export interface Task {
  id: number;
  trip_id: number;
  title: string;
  notes: string | null;
  due_date: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH";
  done: number; // 0 | 1
  created_at: string;
}

export function listTasks(tripId: number): Task[] {
  return db.getAllSync<Task>(
    "SELECT * FROM tasks WHERE trip_id = ? ORDER BY done ASC, priority DESC, created_at ASC",
    [tripId]
  );
}

export function createTask(
  tripId: number,
  data: Omit<Task, "id" | "trip_id" | "created_at">
): void {
  db.runSync(
    `INSERT INTO tasks (trip_id, title, notes, due_date, priority, done)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [tripId, data.title, data.notes, data.due_date, data.priority, data.done]
  );
}

export function toggleTaskDone(id: number, done: boolean): void {
  db.runSync("UPDATE tasks SET done = ? WHERE id = ?", [done ? 1 : 0, id]);
}

export function updateTask(id: number, data: Omit<Task, "id" | "trip_id" | "created_at">): void {
  db.runSync(
    `UPDATE tasks SET title = ?, notes = ?, due_date = ?, priority = ?, done = ? WHERE id = ?`,
    [data.title, data.notes, data.due_date, data.priority, data.done, id]
  );
}

export function deleteTask(id: number): void {
  db.runSync("DELETE FROM tasks WHERE id = ?", [id]);
}
