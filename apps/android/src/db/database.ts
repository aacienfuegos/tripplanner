import * as SQLite from "expo-sqlite";
import { countryNameToCode } from "@tripplanner/shared";

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

  if (user_version < 3) {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS dive_areas (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT    NOT NULL,
        country    TEXT,
        notes      TEXT,
        created_at TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS dive_sites (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        dive_area_id INTEGER REFERENCES dive_areas(id) ON DELETE SET NULL,
        name         TEXT    NOT NULL,
        address      TEXT,
        country      TEXT,
        region       TEXT,
        latitude     REAL,
        longitude    REAL,
        notes        TEXT,
        source       TEXT    NOT NULL DEFAULT 'MANUAL',
        external_id  TEXT,
        created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS dive_equipment (
        id                       INTEGER PRIMARY KEY AUTOINCREMENT,
        name                     TEXT    NOT NULL,
        category                 TEXT    NOT NULL,
        brand                    TEXT,
        model                    TEXT,
        size                     TEXT,
        serial_number            TEXT,
        purchase_date            TEXT,
        purchase_price           REAL,
        status                   TEXT    NOT NULL DEFAULT 'OWNED',
        last_service_date        TEXT,
        service_interval_months  INTEGER,
        notes                    TEXT,
        created_at               TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at               TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS dive_equipment_service (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        equipment_id INTEGER NOT NULL REFERENCES dive_equipment(id) ON DELETE CASCADE,
        date        TEXT    NOT NULL,
        description TEXT    NOT NULL,
        cost        REAL,
        notes       TEXT,
        created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS dive_certifications (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        agency          TEXT    NOT NULL,
        level           TEXT    NOT NULL,
        cert_number     TEXT,
        issue_date      TEXT,
        instructor_name TEXT,
        notes           TEXT,
        source          TEXT    NOT NULL DEFAULT 'MANUAL',
        external_id     TEXT,
        created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS dive_logs (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        trip_id           INTEGER REFERENCES trips(id) ON DELETE SET NULL,
        dive_site_id      INTEGER REFERENCES dive_sites(id) ON DELETE SET NULL,
        date              TEXT    NOT NULL,
        dive_number       INTEGER NOT NULL,
        depth_max         REAL    NOT NULL,
        bottom_time       INTEGER NOT NULL,
        surface_interval  INTEGER,
        gas_mix           TEXT    NOT NULL DEFAULT 'AIR',
        o2_percentage     INTEGER,
        helium_percentage INTEGER,
        pressure_start    INTEGER,
        pressure_end      INTEGER,
        water_temp        REAL,
        air_temp          REAL,
        visibility        REAL,
        dive_type         TEXT,
        buddy_name        TEXT,
        suit_type         TEXT,
        weight            REAL,
        notes             TEXT,
        rating            INTEGER,
        source            TEXT    NOT NULL DEFAULT 'MANUAL',
        external_id       TEXT,
        created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at        TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS dive_log_equipment (
        dive_log_id  INTEGER NOT NULL REFERENCES dive_logs(id) ON DELETE CASCADE,
        equipment_id INTEGER NOT NULL REFERENCES dive_equipment(id) ON DELETE CASCADE,
        PRIMARY KEY (dive_log_id, equipment_id)
      );

      PRAGMA user_version = 3;
    `);
  }

  if (user_version < 4) {
    db.execSync(`
      ALTER TABLE dive_logs ADD COLUMN current TEXT;
      ALTER TABLE dive_logs ADD COLUMN visibility_horizontal REAL;
      ALTER TABLE dive_logs ADD COLUMN divemaster TEXT;
      ALTER TABLE dive_logs ADD COLUMN boat TEXT;
      ALTER TABLE dive_logs ADD COLUMN entry_type TEXT;
      ALTER TABLE dive_logs ADD COLUMN deco_required INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE dive_logs ADD COLUMN safety_stop_minutes INTEGER;
      ALTER TABLE dive_logs ADD COLUMN min_ppo2 REAL;
      ALTER TABLE dive_logs ADD COLUMN max_ppo2 REAL;
      ALTER TABLE dive_logs ADD COLUMN cns_percent INTEGER;

      CREATE TABLE IF NOT EXISTS dive_log_profile_samples (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        dive_log_id INTEGER NOT NULL REFERENCES dive_logs(id) ON DELETE CASCADE,
        seconds     INTEGER NOT NULL,
        depth       REAL    NOT NULL,
        temp        REAL
      );

      CREATE INDEX IF NOT EXISTS idx_dive_log_profile_samples_dive
        ON dive_log_profile_samples(dive_log_id, seconds);

      PRAGMA user_version = 4;
    `);
  }

  if (user_version < 5) {
    db.execSync(`
      ALTER TABLE accommodations ADD COLUMN latitude REAL;
      ALTER TABLE accommodations ADD COLUMN longitude REAL;
      ALTER TABLE activities ADD COLUMN latitude REAL;
      ALTER TABLE activities ADD COLUMN longitude REAL;
      ALTER TABLE flights ADD COLUMN origin_lat REAL;
      ALTER TABLE flights ADD COLUMN origin_lng REAL;
      ALTER TABLE flights ADD COLUMN destination_lat REAL;
      ALTER TABLE flights ADD COLUMN destination_lng REAL;

      PRAGMA user_version = 5;
    `);
  }

  if (user_version < 6) {
    db.execSync(`
      ALTER TABLE dive_log_profile_samples ADD COLUMN ndl_minutes INTEGER;

      PRAGMA user_version = 6;
    `);
  }

  if (user_version < 7) {
    // country pasa de texto libre a código ISO 3166-1 (ver #264) — se
    // traducen los valores ya guardados en vez de perderlos. No es una
    // ALTER de columna: sigue siendo TEXT, solo cambia lo que contiene.
    for (const table of ["dive_areas", "dive_sites"] as const) {
      const rows = db.getAllSync<{ id: number; country: string | null }>(
        `SELECT id, country FROM ${table} WHERE country IS NOT NULL`
      );
      for (const row of rows) {
        const code = countryNameToCode(row.country!);
        if (code && code !== row.country) {
          db.runSync(`UPDATE ${table} SET country = ? WHERE id = ?`, [code, row.id]);
        }
      }
    }

    db.execSync("PRAGMA user_version = 7");
  }

  if (user_version < 8) {
    // Paridad con la web (#263): profundidad máxima y tipo de agua del
    // punto de inmersión, ver #274.
    db.execSync(`
      ALTER TABLE dive_sites ADD COLUMN max_depth REAL;
      ALTER TABLE dive_sites ADD COLUMN water_type TEXT;

      PRAGMA user_version = 8;
    `);
  }
}
