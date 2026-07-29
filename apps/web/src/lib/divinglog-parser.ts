import Database from "better-sqlite3";

// Server-side, read-only parser for Diving Log (4.2.0 / DiveLogDT) SQLite
// exports — see issue #169 for the verified field-by-field mapping.
//
// Security: the file is a user-uploaded binary opened with a full SQL engine.
// To keep this from becoming an arbitrary-query surface driven by attacker
// content, every SELECT below is a fixed, hardcoded column list against a
// fixed table name — never built from PRAGMA table_info() or anything else
// the uploaded file declares about itself. If a table or column is missing,
// better-sqlite3 throws and we surface a generic "unrecognized file" error
// instead of adapting to whatever schema the file happens to have.

export class DivingLogFileError extends Error {}

export interface DivingLogParsedSite {
  externalId: string;
  name: string;
  country: string | undefined;
  latitude: number | null;
  longitude: number | null;
  notes: string | undefined;
}

export interface DivingLogParsedEntry {
  externalId: string;
  date: string;
  depthMax: string;
  bottomTime: string;
  surfaceInterval: string | undefined;
  gasMix: "AIR" | "NITROX" | "TRIMIX" | "OXYGEN";
  o2Percentage: string | undefined;
  heliumPercentage: string | undefined;
  pressureStart: string | undefined;
  pressureEnd: string | undefined;
  waterTemp: string | undefined;
  airTemp: string | undefined;
  visibility: string | undefined;
  diveType: string | undefined;
  buddyName: string | undefined;
  suitType: string | undefined;
  weight: string | undefined;
  notes: string | undefined;
  rating: string | undefined;
  diveSiteExternalId: string | null;
}

export interface DivingLogParsedCertification {
  externalId: string;
  agency: string;
  level: string;
  certNumber: string | undefined;
  issueDate: string | undefined;
  instructorName: string | undefined;
}

export interface DivingLogParseResult {
  sites: DivingLogParsedSite[];
  entries: DivingLogParsedEntry[];
  certifications: DivingLogParsedCertification[];
}

interface CountryRow {
  ID: number;
  Country: string | null;
}

interface PlaceRow {
  ID: number;
  CountryID: number | null;
  Place: string | null;
  Lat: string | null;
  Lon: string | null;
  Comments: string | null;
  UUID: string | null;
}

interface BrevetRow {
  ID: number;
  Brevet: string | null;
  Org: string | null;
  CertDate: string | null;
  Number: string | null;
  Instructor: string | null;
  UUID: string | null;
}

interface TankRow {
  LogID: number;
  SortOrd: number | null;
  PresS: number | null;
  PresE: number | null;
  O2: number | null;
  He: number | null;
}

interface LogbookRow {
  ID: number;
  Divedate: string | null;
  Entrytime: string | null;
  Surfint: string | null;
  Country: string | null;
  Place: string | null;
  PlaceID: number | null;
  Divetime: number | null;
  Depth: number | null;
  Buddy: string | null;
  Comments: string | null;
  Divetype: string | null;
  Airtemp: number | null;
  Watertemp: number | null;
  Visibility: number | null;
  Weight: number | null;
  Divesuit: string | null;
  Rating: number | null;
  UUID: string | null;
}

function runQuery<T>(db: Database.Database, sql: string): T[] {
  try {
    return db.prepare(sql).all() as T[];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new DivingLogFileError(
      `Fichero no reconocido: no coincide con el esquema esperado de Diving Log (${message})`,
    );
  }
}

// "HH:MM" duration text -> total minutes. Diving Log stores Surfint this way
// (e.g. "24:59" = 24h59min), not as a plain integer.
function hmsToMinutes(value: string | null): number | undefined {
  if (!value) return undefined;
  const match = /^(\d+):(\d{2})$/.exec(value.trim());
  if (!match) return undefined;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

function nonEmpty(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function toNumberOrNull(value: string | null | undefined): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// No column in this dataset spells out "Nitrox"/"Trimix" as free text — Diving
// Log's own Gas text field is empty in real exports (verified against #169's
// sample file). O2%/He% on the primary tank are the only reliable signal, so
// the gas mix is inferred from them rather than copied from a label.
function classifyGasMix(o2: number | null, he: number | null): DivingLogParsedEntry["gasMix"] {
  if (he !== null && he > 0) return "TRIMIX";
  if (o2 !== null && o2 >= 95) return "OXYGEN";
  if (o2 !== null && o2 > 21) return "NITROX";
  return "AIR";
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

export function parseDivingLogDatabase(filePath: string): DivingLogParseResult {
  let db: Database.Database;
  try {
    db = new Database(filePath, { readonly: true, fileMustExist: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new DivingLogFileError(`No se pudo abrir el fichero como base de datos SQLite (${message})`);
  }

  try {
    const countries = runQuery<CountryRow>(db, "SELECT ID, Country FROM Country");
    const places = runQuery<PlaceRow>(
      db,
      "SELECT ID, CountryID, Place, Lat, Lon, Comments, UUID FROM Place",
    );
    const brevets = runQuery<BrevetRow>(
      db,
      "SELECT ID, Brevet, Org, CertDate, Number, Instructor, UUID FROM Brevets",
    );
    const tanks = runQuery<TankRow>(
      db,
      "SELECT LogID, SortOrd, PresS, PresE, O2, He FROM Tank ORDER BY LogID, SortOrd",
    );
    const logbook = runQuery<LogbookRow>(
      db,
      `SELECT ID, Divedate, Entrytime, Surfint, Country, Place, PlaceID, Divetime, Depth,
              Buddy, Comments, Divetype, Airtemp, Watertemp, Visibility, Weight, Divesuit,
              Rating, UUID
       FROM Logbook`,
    );

    const countryNameById = new Map<number, string>();
    for (const c of countries) {
      const name = nonEmpty(c.Country);
      if (name) countryNameById.set(c.ID, name);
    }

    // Place.CountryID is unreliable in real exports (empty in #169's sample
    // file, even though Country rows exist) — Logbook.Country is denormalized
    // per-dive and does carry the value, so it's used as a fallback keyed by
    // PlaceID. First non-empty value wins.
    const countryByPlaceId = new Map<number, string>();
    for (const row of logbook) {
      if (!row.PlaceID) continue;
      if (countryByPlaceId.has(row.PlaceID)) continue;
      const country = nonEmpty(row.Country);
      if (country) countryByPlaceId.set(row.PlaceID, country);
    }

    const placeExternalIdById = new Map<number, string>();
    const sites: DivingLogParsedSite[] = [];
    for (const place of places) {
      const externalId = nonEmpty(place.UUID);
      if (!externalId || !place.ID) continue;
      placeExternalIdById.set(place.ID, externalId);

      const country =
        (place.CountryID ? countryNameById.get(place.CountryID) : undefined) ??
        countryByPlaceId.get(place.ID);

      sites.push({
        externalId,
        name: nonEmpty(place.Place) ?? "—",
        country,
        latitude: toNumberOrNull(place.Lat),
        longitude: toNumberOrNull(place.Lon),
        notes: nonEmpty(place.Comments),
      });
    }

    const tanksByLogId = new Map<number, TankRow[]>();
    for (const tank of tanks) {
      const list = tanksByLogId.get(tank.LogID) ?? [];
      list.push(tank);
      tanksByLogId.set(tank.LogID, list);
    }

    const entries: DivingLogParsedEntry[] = [];
    for (const row of logbook) {
      const externalId = nonEmpty(row.UUID);
      if (!externalId || !row.Divedate) continue;

      const time = nonEmpty(row.Entrytime) ?? "00:00";
      const date = `${row.Divedate}T${time.length === 5 ? time : "00:00"}:00`;

      const rowTanks = (tanksByLogId.get(row.ID) ?? []).slice().sort(
        (a, b) => (a.SortOrd ?? 0) - (b.SortOrd ?? 0),
      );
      const primaryTank = rowTanks[0];
      const extraTanks = rowTanks.length - 1;

      const o2 = primaryTank?.O2 ?? null;
      const he = primaryTank?.He ?? null;

      const notesParts = [nonEmpty(row.Comments)];
      if (extraTanks > 0) {
        notesParts.push(
          `Import: ${extraTanks} ${pluralize(extraTanks, "botella adicional no importada", "botellas adicionales no importadas")} (ver Diving Log)`,
        );
      }
      const notes = notesParts.filter(Boolean).join(" — ") || undefined;

      const rating = row.Rating && row.Rating >= 1 && row.Rating <= 5 ? String(row.Rating) : undefined;

      entries.push({
        externalId,
        date,
        depthMax: String(row.Depth ?? 0),
        bottomTime: String(Math.round(row.Divetime ?? 0)),
        surfaceInterval: hmsToMinutes(row.Surfint)?.toString(),
        gasMix: classifyGasMix(o2, he),
        o2Percentage: o2 !== null ? String(Math.round(o2)) : undefined,
        heliumPercentage: he !== null ? String(Math.round(he)) : undefined,
        pressureStart: primaryTank?.PresS != null ? String(Math.round(primaryTank.PresS)) : undefined,
        pressureEnd: primaryTank?.PresE != null ? String(Math.round(primaryTank.PresE)) : undefined,
        waterTemp: row.Watertemp != null ? String(row.Watertemp) : undefined,
        airTemp: row.Airtemp != null ? String(row.Airtemp) : undefined,
        visibility: row.Visibility != null ? String(row.Visibility) : undefined,
        diveType: nonEmpty(row.Divetype),
        buddyName: nonEmpty(row.Buddy),
        suitType: nonEmpty(row.Divesuit),
        weight: row.Weight != null ? String(row.Weight) : undefined,
        notes,
        rating,
        diveSiteExternalId: row.PlaceID ? (placeExternalIdById.get(row.PlaceID) ?? null) : null,
      });
    }

    const certifications: DivingLogParsedCertification[] = [];
    for (const brevet of brevets) {
      const externalId = nonEmpty(brevet.UUID);
      if (!externalId) continue;
      const agency = nonEmpty(brevet.Org);
      const level = nonEmpty(brevet.Brevet);
      if (!agency || !level) continue;

      certifications.push({
        externalId,
        agency,
        level,
        certNumber: nonEmpty(brevet.Number),
        issueDate: nonEmpty(brevet.CertDate),
        instructorName: nonEmpty(brevet.Instructor),
      });
    }

    return { sites, entries, certifications };
  } finally {
    db.close();
  }
}
