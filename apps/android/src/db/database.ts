import * as SQLite from "expo-sqlite";

export const db = SQLite.openDatabaseSync("tripplanner.db");

export function initDatabase(): void {
  db.execSync("PRAGMA journal_mode = WAL");
  db.execSync("PRAGMA foreign_keys = ON");

  const { user_version } = db.getFirstSync<{ user_version: number }>(
    "PRAGMA user_version"
  )!;

  if (user_version < 1) {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS trips (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT    NOT NULL,
        description TEXT,
        start_date  TEXT,
        end_date    TEXT,
        currency    TEXT    NOT NULL DEFAULT 'EUR',
        budget      REAL,
        created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS flights (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        trip_id          INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        airline          TEXT,
        flight_number    TEXT,
        origin           TEXT    NOT NULL,
        destination      TEXT    NOT NULL,
        departure_at     TEXT,
        arrival_at       TEXT,
        booking_ref      TEXT,
        confirmation_url TEXT,
        seat_number      TEXT,
        class            TEXT    NOT NULL DEFAULT 'ECONOMY',
        price            REAL,
        notes            TEXT,
        created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS accommodations (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        trip_id          INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        name             TEXT    NOT NULL,
        type             TEXT    NOT NULL DEFAULT 'HOTEL',
        address          TEXT,
        city             TEXT    NOT NULL,
        check_in         TEXT,
        check_out        TEXT,
        booking_ref      TEXT,
        confirmation_url TEXT,
        price            REAL,
        price_per_night  REAL,
        notes            TEXT,
        created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS activities (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        trip_id          INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        name             TEXT    NOT NULL,
        type             TEXT    NOT NULL DEFAULT 'ACTIVITY',
        description      TEXT,
        location         TEXT,
        city             TEXT,
        scheduled_at     TEXT,
        duration         INTEGER,
        booking_ref      TEXT,
        confirmation_url TEXT,
        price            REAL,
        status           TEXT    NOT NULL DEFAULT 'PENDING',
        notes            TEXT,
        created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS expenses (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        trip_id     INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        description TEXT    NOT NULL,
        category    TEXT    NOT NULL,
        amount      REAL    NOT NULL,
        currency    TEXT    NOT NULL DEFAULT 'EUR',
        date        TEXT    NOT NULL,
        paid        INTEGER NOT NULL DEFAULT 0,
        notes       TEXT,
        created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS packing_items (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        trip_id    INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        name       TEXT    NOT NULL,
        category   TEXT    NOT NULL,
        quantity   INTEGER NOT NULL DEFAULT 1,
        packed     INTEGER NOT NULL DEFAULT 0,
        created_at TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS documents (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        trip_id    INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        name       TEXT    NOT NULL,
        type       TEXT    NOT NULL,
        expires_at TEXT,
        notes      TEXT,
        created_at TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      PRAGMA user_version = 1;
    `);
  }

  if (user_version < 2) {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS tasks (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        trip_id    INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        title      TEXT    NOT NULL,
        notes      TEXT,
        due_date   TEXT,
        priority   TEXT    NOT NULL DEFAULT 'MEDIUM',
        done       INTEGER NOT NULL DEFAULT 0,
        created_at TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      PRAGMA user_version = 2;
    `);
  }
}
