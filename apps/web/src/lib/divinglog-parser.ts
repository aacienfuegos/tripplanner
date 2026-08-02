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
  region: string | undefined;
  latitude: number | null;
  longitude: number | null;
  notes: string | undefined;
}

export interface DivingLogParsedTrip {
  externalId: string;
  name: string;
  startDate: string;
  endDate: string;
}

export interface DivingLogParsedProfileSample {
  seconds: number;
  depth: number;
  temp: number | null;
  ndlMinutes: number | null;
}

export interface DivingLogParsedEntry {
  externalId: string;
  date: string;
  time: string;
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
  visibilityHorizontal: string | undefined;
  diveType: string | undefined;
  buddyName: string | undefined;
  suitType: string | undefined;
  weight: string | undefined;
  notes: string | undefined;
  rating: string | undefined;
  divemaster: string | undefined;
  boat: string | undefined;
  decoRequired: string | undefined;
  entryType: "SHORE" | "BOAT" | undefined;
  minPpo2: string | undefined;
  maxPpo2: string | undefined;
  cnsPercent: string | undefined;
  diveSiteExternalId: string | null;
  tripExternalId: string | null;
  profileSamples: DivingLogParsedProfileSample[];
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
  trips: DivingLogParsedTrip[];
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

interface CityRow {
  ID: number;
  City: string | null;
}

interface DivetypeRow {
  ID: number;
  Typename: string | null;
}

interface TripRow {
  ID: number;
  TripName: string | null;
  StartDate: string | null;
  EndDate: string | null;
  UUID: string | null;
}

interface LogbookRow {
  ID: number;
  Divedate: string | null;
  Entrytime: string | null;
  Surfint: string | null;
  Country: string | null;
  Place: string | null;
  PlaceID: number | null;
  CityID: number | null;
  Divetime: number | null;
  Depth: number | null;
  Buddy: string | null;
  Comments: string | null;
  Divetype: string | null;
  Entry: number | null;
  Airtemp: number | null;
  Watertemp: number | null;
  Visibility: number | null;
  VisHor: string | null;
  Weight: number | null;
  Divesuit: string | null;
  Rating: number | null;
  UUID: string | null;
  Divemaster: string | null;
  Boat: string | null;
  Deco: number | null;
  Profile: string | null;
  ProfileInt: number | null;
  Profile2: string | null;
  Profile4: string | null;
  O2: number | null;
  He: number | null;
  PresS: number | null;
  PresE: number | null;
  DblTank: number | null;
  TripID: number | null;
  MinPPO2: number | null;
  MaxPPO2: number | null;
  CNS: string | null;
}

// Caps every table read at the SQL level (not just post-parse Zod validation)
// so a maliciously oversized file can't block the event loop by forcing
// better-sqlite3's synchronous .all() to load millions of rows into memory.
// No real dive logbook comes close to this — even a lifetime of daily diving
// stays in the low thousands of dives.
const MAX_ROWS_PER_TABLE = 5000;

function runQuery<T>(db: Database.Database, sql: string): T[] {
  try {
    return db.prepare(`${sql} LIMIT ${MAX_ROWS_PER_TABLE}`).all() as T[];
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

// "H:MM"/"HH:MM" -> zero-padded "HH:MM", same tolerance for a missing
// leading zero as hmsToMinutes() below. Falls back to midnight for anything
// that doesn't match (missing/malformed Entrytime), never throws.
function normalizeEntryTime(value: string | null): string {
  const match = value ? /^(\d{1,2}):(\d{2})$/.exec(value.trim()) : null;
  if (!match) return "00:00";
  return `${match[1].padStart(2, "0")}:${match[2]}`;
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

// Diving Log guarda internamente en imperial y convierte a métrico al
// exportar — esa conversión dentro de su propio export arrastra ruido de
// coma flotante (25.420320000000004 en vez de 25.4). Redondea a la misma
// precisión (1 decimal) que usa el resto de la app para estos campos
// (step="0.1" en el formulario manual).
function round1(value: number): number {
  return Math.round(value * 10) / 10;
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

// Diving Log's Entry field has 6 possible values (Shore, Boat, Pool,
// Aquarium, Jetty, Ice — confirmed against its own UI, not documented in the
// export schema itself); our own DiveEntryType enum only distinguishes
// SHORE/BOAT, so the other 4 are left unmapped rather than guessed into one
// of the two.
function resolveEntryType(value: number | null): "SHORE" | "BOAT" | undefined {
  if (value === 1) return "SHORE";
  if (value === 2) return "BOAT";
  return undefined;
}

// Diving Log's own City field isn't a dive-area classification — it's the
// base of operations (city/island/hotel/liveaboard/camping/day trip, per
// City.Type), which doesn't always match the actual dive area. Divers after
// finer grouping resort to a naming convention instead: verified 100%
// consistent across a real 27-site export, "{Site} - {Area}" (e.g. "Piles 1 -
// Cabo de Palos"). That suffix is more specific and diver-recognizable than
// City, so it takes priority; City is only used as a fallback for places
// without it.
function splitPlaceName(raw: string): { name: string; area: string | undefined } {
  const separatorIndex = raw.lastIndexOf(" - ");
  if (separatorIndex === -1) return { name: raw, area: undefined };
  return {
    name: raw.slice(0, separatorIndex).trim() || raw,
    area: nonEmpty(raw.slice(separatorIndex + 3)),
  };
}

// Logbook.Divetype stores Divetype.ID values joined by commas (e.g. "2,5,7"),
// never the type names — without this join the user sees raw digit codes
// instead of "Education, Deep, Wreck".
function resolveDiveType(raw: string | null, namesById: Map<number, string>): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  const names = trimmed
    .split(",")
    .map((part) => namesById.get(Number(part.trim())))
    .filter((name): name is string => !!name);
  return names.length > 0 ? names.join(", ") : undefined;
}

// Profile/Profile2/Profile4 guardan muestras concatenadas sin separador, un
// canal por columna, todos al mismo ProfileInt. Cada canal usa un ancho de
// chunk distinto pero el mismo patrón: los primeros dígitos son el valor,
// el resto queda sin usar en los exports verificados hasta ahora (issue de
// perfil de buceo, verificado contra un export real de 65 inmersiones):
//   Profile  (profundidad): 12 chars, 5 dígitos = cm
//   Profile2 (temperatura): 11 chars, 3 dígitos = décimas de °C
//   Profile4 (NDL restante): 9 chars, 3 dígitos = minutos (598 = sin límite / superficie)
// Profile2/Profile4 traen una muestra menos que Profile (falta la última,
// de superficie) — se alinean por índice y se ignora el resto si sobra.
const PROFILE_SAMPLE_CHARS = 12;
const PROFILE_DEPTH_CHARS = 5;
const TEMP_SAMPLE_CHARS = 11;
const TEMP_VALUE_CHARS = 3;
const NDL_SAMPLE_CHARS = 9;
const NDL_VALUE_CHARS = 3;
const MAX_PROFILE_SAMPLES = 4000;

function decodeChannel(raw: string | null, sampleChars: number, valueChars: number): number[] {
  if (!raw) return [];
  const count = Math.min(Math.floor(raw.length / sampleChars), MAX_PROFILE_SAMPLES);
  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    const chunk = raw.slice(i * sampleChars, i * sampleChars + valueChars);
    const value = parseInt(chunk, 10);
    values.push(Number.isFinite(value) ? value : NaN);
  }
  return values;
}

function decodeProfile(
  profile: string | null,
  intervalSeconds: number | null,
  profile2: string | null,
  profile4: string | null,
): DivingLogParsedProfileSample[] {
  if (!profile || !intervalSeconds || intervalSeconds <= 0) return [];
  const depthCm = decodeChannel(profile, PROFILE_SAMPLE_CHARS, PROFILE_DEPTH_CHARS);
  const tempDeci = decodeChannel(profile2, TEMP_SAMPLE_CHARS, TEMP_VALUE_CHARS);
  const ndl = decodeChannel(profile4, NDL_SAMPLE_CHARS, NDL_VALUE_CHARS);

  const samples: DivingLogParsedProfileSample[] = [];
  for (let i = 0; i < depthCm.length; i++) {
    if (!Number.isFinite(depthCm[i])) continue;
    const temp = Number.isFinite(tempDeci[i]) ? round1(tempDeci[i] / 10) : null;
    const ndlMinutes = Number.isFinite(ndl[i]) ? ndl[i] : null;
    samples.push({ seconds: (i + 1) * intervalSeconds, depth: round1(depthCm[i] / 100), temp, ndlMinutes });
  }
  return samples;
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
    const cities = runQuery<CityRow>(db, "SELECT ID, City FROM City");
    const divetypes = runQuery<DivetypeRow>(db, "SELECT ID, Typename FROM Divetype");
    const trips = runQuery<TripRow>(db, "SELECT ID, TripName, StartDate, EndDate, UUID FROM Trip");
    const logbook = runQuery<LogbookRow>(
      db,
      `SELECT ID, Divedate, Entrytime, Surfint, Country, Place, PlaceID, CityID, Divetime, Depth,
              Buddy, Comments, Divetype, Entry, Airtemp, Watertemp, Visibility, VisHor, Weight, Divesuit,
              Rating, UUID, Divemaster, Boat, Deco, Profile, ProfileInt, Profile2, Profile4,
              O2, He, PresS, PresE, DblTank, TripID, MinPPO2, MaxPPO2, CNS
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

    const cityNameById = new Map<number, string>();
    for (const city of cities) {
      const name = nonEmpty(city.City);
      if (name) cityNameById.set(city.ID, name);
    }

    // Place itself has no city column — only Logbook.CityID does, denormalized
    // per-dive same as Country above. First non-empty value wins.
    const regionByPlaceId = new Map<number, string>();
    for (const row of logbook) {
      if (!row.PlaceID) continue;
      if (regionByPlaceId.has(row.PlaceID)) continue;
      const region = row.CityID ? cityNameById.get(row.CityID) : undefined;
      if (region) regionByPlaceId.set(row.PlaceID, region);
    }

    const divetypeNameById = new Map<number, string>();
    for (const dt of divetypes) {
      const name = nonEmpty(dt.Typename);
      if (name) divetypeNameById.set(dt.ID, name);
    }

    const tripExternalIdById = new Map<number, string>();
    const parsedTrips: DivingLogParsedTrip[] = [];
    for (const trip of trips) {
      const externalId = nonEmpty(trip.UUID);
      const name = nonEmpty(trip.TripName);
      if (!externalId || !trip.ID || !name || !trip.StartDate || !trip.EndDate) continue;
      tripExternalIdById.set(trip.ID, externalId);
      parsedTrips.push({ externalId, name, startDate: trip.StartDate, endDate: trip.EndDate });
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

      const { name, area } = splitPlaceName(nonEmpty(place.Place) ?? "—");

      sites.push({
        externalId,
        name,
        country,
        region: area ?? regionByPlaceId.get(place.ID),
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

      const date = row.Divedate;
      const time = normalizeEntryTime(row.Entrytime);

      const rowTanks = (tanksByLogId.get(row.ID) ?? []).slice().sort(
        (a, b) => (a.SortOrd ?? 0) - (b.SortOrd ?? 0),
      );
      const primaryTank = rowTanks[0];
      const isDoubleTank = row.DblTank === 1;
      // Diving Log guarda un resumen de gas/presión por buceo directamente en
      // Logbook (O2/He/PresS/PresE) — es lo que muestra su propia UI y lo
      // único fiable en exports reales verificados: la tabla Tank suele traer
      // 2 filas idénticas con O2 de plantilla (p.ej. 19%) y presión vacía
      // incluso en buceos de una sola botella, sin relación con el gas real
      // usado. Tank solo se usa como fallback si el resumen falta, y el aviso
      // de "botella adicional no importada" solo aplica si DblTank marca que
      // el buceo fue realmente de doble botella.
      const o2 = row.O2 ?? primaryTank?.O2 ?? null;
      const he = row.He ?? primaryTank?.He ?? null;
      const pressureStart = row.PresS ?? primaryTank?.PresS ?? null;
      const pressureEnd = row.PresE ?? primaryTank?.PresE ?? null;
      const extraTanks = isDoubleTank ? rowTanks.length - 1 : 0;

      const notesParts = [nonEmpty(row.Comments)];
      if (extraTanks > 0) {
        notesParts.push(
          `Import: ${extraTanks} ${pluralize(extraTanks, "botella adicional no importada", "botellas adicionales no importadas")} (ver Diving Log)`,
        );
      }
      const notes = notesParts.filter(Boolean).join(" — ") || undefined;

      const rating = row.Rating && row.Rating >= 1 && row.Rating <= 5 ? String(row.Rating) : undefined;
      const visHor = toNumberOrNull(row.VisHor);
      const cns = toNumberOrNull(row.CNS);

      entries.push({
        externalId,
        date,
        time,
        depthMax: String(round1(row.Depth ?? 0)),
        bottomTime: String(Math.round(row.Divetime ?? 0)),
        surfaceInterval: hmsToMinutes(row.Surfint)?.toString(),
        gasMix: classifyGasMix(o2, he),
        o2Percentage: o2 !== null ? String(Math.round(o2)) : undefined,
        heliumPercentage: he !== null ? String(Math.round(he)) : undefined,
        pressureStart: pressureStart !== null ? String(Math.round(pressureStart)) : undefined,
        pressureEnd: pressureEnd !== null ? String(Math.round(pressureEnd)) : undefined,
        waterTemp: row.Watertemp != null ? String(round1(row.Watertemp)) : undefined,
        airTemp: row.Airtemp != null ? String(round1(row.Airtemp)) : undefined,
        visibility: row.Visibility != null ? String(round1(row.Visibility)) : undefined,
        visibilityHorizontal: visHor !== null ? String(round1(visHor)) : undefined,
        diveType: resolveDiveType(row.Divetype, divetypeNameById),
        buddyName: nonEmpty(row.Buddy),
        suitType: nonEmpty(row.Divesuit),
        weight: row.Weight != null ? String(round1(row.Weight)) : undefined,
        notes,
        rating,
        divemaster: nonEmpty(row.Divemaster),
        boat: nonEmpty(row.Boat),
        decoRequired: row.Deco === 1 ? "1" : undefined,
        entryType: resolveEntryType(row.Entry),
        minPpo2: row.MinPPO2 != null ? String(round1(row.MinPPO2)) : undefined,
        maxPpo2: row.MaxPPO2 != null ? String(round1(row.MaxPPO2)) : undefined,
        cnsPercent: cns !== null ? String(Math.round(cns)) : undefined,
        diveSiteExternalId: row.PlaceID ? (placeExternalIdById.get(row.PlaceID) ?? null) : null,
        tripExternalId: row.TripID ? (tripExternalIdById.get(row.TripID) ?? null) : null,
        profileSamples: decodeProfile(row.Profile, row.ProfileInt, row.Profile2, row.Profile4),
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

    // La query SQL no garantiza orden — se ordena aquí por fecha+hora
    // descendente para que el import se revise en el mismo orden que el
    // resto de la app (dive-log-list.tsx: más reciente primero).
    entries.sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));

    return { sites, entries, certifications, trips: parsedTrips };
  } finally {
    db.close();
  }
}
