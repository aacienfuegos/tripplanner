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
    CREATE TABLE City('ID' INTEGER PRIMARY KEY, 'City' TEXT);
    CREATE TABLE Divetype('ID' INTEGER PRIMARY KEY, 'Typename' TEXT);
    CREATE TABLE Trip('ID' INTEGER PRIMARY KEY, 'TripName' TEXT, 'StartDate' TEXT, 'EndDate' TEXT, 'UUID' TEXT);
    CREATE TABLE Place('ID' INTEGER PRIMARY KEY, 'CountryID' INTEGER, 'Place' TEXT, 'Lat' TEXT, 'Lon' TEXT, 'Comments' TEXT, 'UUID' TEXT);
    CREATE TABLE Brevets('ID' INTEGER PRIMARY KEY, 'Brevet' TEXT, 'Org' TEXT, 'CertDate' TEXT, 'Number' TEXT, 'Instructor' TEXT, 'UUID' TEXT);
    CREATE TABLE Tank('ID' INTEGER PRIMARY KEY, 'LogID' INTEGER, 'SortOrd' INTEGER, 'PresS' REAL, 'PresE' REAL, 'O2' REAL, 'He' REAL);
    CREATE TABLE Logbook(
      'ID' INTEGER PRIMARY KEY, 'Number' INTEGER, 'Divedate' TEXT, 'Entrytime' TEXT, 'Surfint' TEXT,
      'Country' TEXT, 'CountryID' INTEGER, 'Place' TEXT, 'PlaceID' INTEGER, 'CityID' INTEGER, 'Divetime' REAL, 'Depth' REAL,
      'Buddy' TEXT, 'Comments' TEXT, 'Divetype' TEXT, 'Entry' INTEGER, 'Airtemp' REAL, 'Watertemp' REAL, 'Visibility' INTEGER,
      'VisHor' TEXT, 'Weight' REAL, 'Divesuit' TEXT, 'Rating' INTEGER, 'UUID' TEXT, 'Divemaster' TEXT, 'Boat' TEXT,
      'Deco' INTEGER, 'Profile' TEXT, 'ProfileInt' INTEGER, 'Profile2' TEXT, 'Profile4' TEXT,
      'O2' REAL, 'He' REAL, 'PresS' REAL, 'PresE' REAL, 'DblTank' INTEGER, 'TripID' INTEGER,
      'MinPPO2' REAL, 'MaxPPO2' REAL, 'CNS' TEXT
    );
  `);

  db.prepare("INSERT INTO Country (ID, Country) VALUES (?, ?)").run(1, "Spain");
  db.prepare("INSERT INTO City (ID, City) VALUES (?, ?)").run(1, "Cartagena");
  // IDs mirror the real Divetype lookup table's own numbering (verified
  // against a real 65-dive export) — dive 1's Divetype="2,5" below decodes
  // through this table, not as literal text.
  db.prepare("INSERT INTO Divetype (ID, Typename) VALUES (?, ?)").run(2, "Education");
  db.prepare("INSERT INTO Divetype (ID, Typename) VALUES (?, ?)").run(5, "Deep");
  const tripUuid = randomUUID();
  db.prepare("INSERT INTO Trip (ID, TripName, StartDate, EndDate, UUID) VALUES (?, ?, ?, ?, ?)").run(
    1,
    "Test Trip 2024",
    "2024-06-01",
    "2024-06-03",
    tripUuid,
  );

  const placeInsert = db.prepare(
    "INSERT INTO Place (ID, CountryID, Place, Lat, Lon, Comments, UUID) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  const placeUuids = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  // CountryID left empty on purpose (mirrors the real export where Place.CountryID
  // was unreliable and the Logbook.Country fallback carried the value instead).
  placeInsert.run(1, null, "Wreck Reef", null, null, "Great visibility", placeUuids[0]);
  placeInsert.run(2, null, "Blue Cave", null, null, null, placeUuids[1]);
  placeInsert.run(3, null, "Orphan Site", null, null, null, placeUuids[2]);
  // Mirrors the real "{Site} - {Area}" naming convention (verified against a
  // real 65-dive export) — the parser must split this into name="Piles 1",
  // region="Cabo de Palos", not keep the area glued to the name.
  placeInsert.run(4, null, "Piles 1 - Cabo de Palos", null, null, null, placeUuids[3]);

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
  // Dive 1: single tank, air — Logbook and Tank agree.
  tankInsert.run(1, 1, 200, 60, 21, 0);
  // Dive 2: genuine twinset (DblTank=1 below) — Logbook.O2/He/PresS/PresE left
  // null on purpose, so the parser must fall back to the primary tank row.
  tankInsert.run(2, 1, 220, 80, 32, 0);
  tankInsert.run(2, 2, 220, 90, 32, 0);
  // Dive 3: trimix, Logbook and Tank agree.
  tankInsert.run(3, 1, 210, 70, 18, 35);
  // Dive 5: mirrors the real Diving Log export (issue found against a real
  // 65-dive file) — Tank carries 2 identical placeholder rows (O2 19%, no
  // pressure) regardless of real usage, while Logbook.O2/He/PresS/PresE hold
  // the actual analyzed gas. DblTank=0 (not a real twinset), so the parser
  // must prefer Logbook's values and must NOT emit an "extra bottle" note.
  tankInsert.run(5, 1, null, null, 19, 0);
  tankInsert.run(5, 2, null, null, 19, 0);

  const logInsert = db.prepare(`
    INSERT INTO Logbook (
      ID, Number, Divedate, Entrytime, Surfint, Country, CountryID, Place, PlaceID, CityID, Divetime, Depth,
      Buddy, Comments, Divetype, Entry, Airtemp, Watertemp, Visibility, VisHor, Weight, Divesuit, Rating, UUID,
      Divemaster, Boat, Deco, Profile, ProfileInt, Profile2, Profile4,
      O2, He, PresS, PresE, DblTank, TripID, MinPPO2, MaxPPO2, CNS
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const logUuids = [randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  // 3 samples @ 60s: 5m, 15m, 18m — exercises decodeProfile's 12-char chunking
  // (5-digit depth in cm + 7 unused filler chars per sample).
  const sampleProfile = "005000000000015000000000018000000000";
  // Temp/NDL channels bring one fewer sample than Profile in real exports
  // (missing the trailing surface sample) — mirrored here on purpose.
  const sampleTemp = "28200000000" + "26000000000"; // 28.2°C, 26.0°C
  const sampleNdl = "045000000" + "030000000"; // 45min, 30min
  // Dive 1: CityID=1 (Cartagena) resolves Wreck Reef's region; Entry=1 (Shore);
  // Divetype="2,5" joins to "Education, Deep" via the Divetype table above
  // (never shown as raw digit codes); TripID=1 links it to Test Trip 2024.
  // VisHor/MinPPO2/MaxPPO2/CNS are all empty in every real export seen so
  // far, but the columns and mapping do exist in Diving Log — exercised here
  // with fabricated values since there's no real reference data yet.
  logInsert.run(
    1, 1, "2024-06-01", "10:00", "01:00", "Spain", null, "Wreck Reef", 1, 1, 45, 18,
    null, "First dive of the trip", "2,5", 1, 28, 21, 15, "12", 6, "5mm", 4, logUuids[0],
    "Jane Master", "MV Explorer", 0, sampleProfile, 60, sampleTemp, sampleNdl,
    21, 0, 200, 60, 0, 1, 1.2, 1.4, "8",
  );
  // Dive 2: Entry=2 (Boat); same trip as dive 1.
  logInsert.run(
    2, 2, "2024-06-02", "09:30", "00:45", "Spain", null, "Blue Cave", 2, null, 38, 22,
    null, null, null, 2, 27, 20, 10, null, 6, "5mm", 0, logUuids[1],
    null, null, null, null, null, null, null,
    null, null, null, null, 1, 1, null, null, null,
  );
  // Dive 3: no CityID of its own — exercises the "first non-empty wins"
  // fallback resolving Wreck Reef's region from dive 1's CityID instead.
  logInsert.run(
    3, 3, "2024-06-03", "11:00", null, "Spain", null, "Wreck Reef", 1, null, 40, 30,
    null, null, null, null, 26, 15, 12, null, 8, "7mm", 5, logUuids[2],
    null, null, 1, null, null, null, null,
    18, 35, 210, 70, 0, 1, null, null, null,
  );
  // No PlaceID (0 = "no site", matches the sentinel found in the real export)
  // and no Divetime (missing bottom time, also found in the real export).
  logInsert.run(
    4, 4, "2024-06-04", "08:00", null, null, null, null, 0, null, null, 12,
    null, null, null, null, 24, 18, 8, null, 4, null, 0, logUuids[3],
    null, null, null, null, null, null, null,
    null, null, null, null, 0, null, null, null, null,
  );
  logInsert.run(
    5, 5, "2024-06-05", "12:00", null, "Spain", null, "Wreck Reef", 1, null, 42, 20,
    null, null, null, null, 26, 20, 12, null, 6, "5mm", 5, logUuids[4],
    null, null, 0, null, null, null, null,
    31, 0, 200, 50, 0, null, null, null, null,
  );

  db.close();
  return dbPath;
}
