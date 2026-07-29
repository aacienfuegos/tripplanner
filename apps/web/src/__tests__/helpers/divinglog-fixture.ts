import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

// Builds a tiny, synthetic Diving Log (4.2.0) SQLite file with invented data —
// used only by vitest. Never derived from a real export (see #169: real
// Diving Log files can contain a Buddy table with third-party PII).
export function buildDivingLogFixture(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "divinglog-fixture-"));
  const dbPath = path.join(dir, "fixture.sqlite");
  const db = new Database(dbPath);

  db.exec(`
    CREATE TABLE Country('ID' INTEGER PRIMARY KEY, 'LogID' INTEGER, 'Country' TEXT, 'UUID' TEXT);
    CREATE TABLE Place('ID' INTEGER PRIMARY KEY, 'CountryID' INTEGER, 'Place' TEXT, 'Lat' TEXT, 'Lon' TEXT, 'Comments' TEXT, 'UUID' TEXT);
    CREATE TABLE Brevets('ID' INTEGER PRIMARY KEY, 'Brevet' TEXT, 'Org' TEXT, 'CertDate' TEXT, 'Number' TEXT, 'Instructor' TEXT, 'UUID' TEXT);
    CREATE TABLE Tank('ID' INTEGER PRIMARY KEY, 'LogID' INTEGER, 'SortOrd' INTEGER, 'PresS' REAL, 'PresE' REAL, 'O2' REAL, 'He' REAL);
    CREATE TABLE Logbook(
      'ID' INTEGER PRIMARY KEY, 'Number' INTEGER, 'Divedate' TEXT, 'Entrytime' TEXT, 'Surfint' TEXT,
      'Country' TEXT, 'CountryID' INTEGER, 'Place' TEXT, 'PlaceID' INTEGER, 'Divetime' REAL, 'Depth' REAL,
      'Buddy' TEXT, 'Comments' TEXT, 'Divetype' TEXT, 'Airtemp' REAL, 'Watertemp' REAL, 'Visibility' INTEGER,
      'Weight' REAL, 'Divesuit' TEXT, 'Rating' INTEGER, 'UUID' TEXT
    );
  `);

  db.prepare("INSERT INTO Country (ID, Country) VALUES (?, ?)").run(1, "Spain");

  const placeInsert = db.prepare(
    "INSERT INTO Place (ID, CountryID, Place, Lat, Lon, Comments, UUID) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  const placeUuids = [randomUUID(), randomUUID(), randomUUID()];
  // CountryID left empty on purpose (mirrors the real export where Place.CountryID
  // was unreliable and the Logbook.Country fallback carried the value instead).
  placeInsert.run(1, null, "Wreck Reef", null, null, "Great visibility", placeUuids[0]);
  placeInsert.run(2, null, "Blue Cave", null, null, null, placeUuids[1]);
  placeInsert.run(3, null, "Orphan Site", null, null, null, placeUuids[2]);

  db.prepare("INSERT INTO Brevets (ID, Brevet, Org, CertDate, Number, Instructor, UUID) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    1,
    "Advanced Open Water",
    "PADI",
    "2020-05-01",
    "AOW-0001",
    "Jane Instructor",
    randomUUID(),
  );

  const tankInsert = db.prepare(
    "INSERT INTO Tank (LogID, SortOrd, PresS, PresE, O2, He) VALUES (?, ?, ?, ?, ?, ?)",
  );
  // Dive 1: single tank, air.
  tankInsert.run(1, 1, 200, 60, 21, 0);
  // Dive 2: two tanks (twinset) — primary is SortOrd 1, extra should be summarized in notes.
  tankInsert.run(2, 1, 220, 80, 32, 0);
  tankInsert.run(2, 2, 220, 90, 32, 0);
  // Dive 3: trimix.
  tankInsert.run(3, 1, 210, 70, 18, 35);

  const logInsert = db.prepare(`
    INSERT INTO Logbook (
      ID, Number, Divedate, Entrytime, Surfint, Country, CountryID, Place, PlaceID, Divetime, Depth,
      Buddy, Comments, Divetype, Airtemp, Watertemp, Visibility, Weight, Divesuit, Rating, UUID
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const logUuids = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  logInsert.run(
    1, 1, "2024-06-01", "10:00", "01:00", "Spain", null, "Wreck Reef", 1, 45, 18,
    null, "First dive of the trip", "2,5", 28, 21, 15, 6, "5mm", 4, logUuids[0],
  );
  logInsert.run(
    2, 2, "2024-06-02", "09:30", "00:45", "Spain", null, "Blue Cave", 2, 38, 22,
    null, null, null, 27, 20, 10, 6, "5mm", 0, logUuids[1],
  );
  logInsert.run(
    3, 3, "2024-06-03", "11:00", null, "Spain", null, "Wreck Reef", 1, 40, 30,
    null, null, null, 26, 15, 12, 8, "7mm", 5, logUuids[2],
  );
  // No PlaceID (0 = "no site", matches the sentinel found in the real export)
  // and no Divetime (missing bottom time, also found in the real export).
  logInsert.run(
    4, 4, "2024-06-04", "08:00", null, null, null, null, 0, null, 12,
    null, null, null, 24, 18, 8, 4, null, 0, logUuids[3],
  );

  db.close();
  return dbPath;
}
