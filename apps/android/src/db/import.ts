/**
 * Port of the web app's src/actions/import.ts duplicate-detection and bulk-insert logic.
 * Runs synchronously on the local SQLite DB — no server, no auth.
 */
import { importPayloadSchema, ImportPayload } from "@tripplanner/shared";
import { db } from "./database";
import { bulkCreateFlights, encryptImportFlights } from "./flights";
import { bulkCreateAccommodations, encryptImportAccommodations } from "./accommodations";
import { bulkCreateActivities, encryptImportActivities } from "./activities";
import { bulkCreateExpenses } from "./expenses";
import { bulkCreatePackingItems } from "./packing";
import { bulkCreateDocuments, encryptImportDocuments } from "./documents";
import { decryptText } from "@/crypto/fieldEncryption";

export interface ImportResult {
  flights: number;
  accommodations: number;
  activities: number;
  expenses: number;
  packing: number;
  documents: number;
}

export async function bulkImport(tripId: number, payload: ImportPayload): Promise<ImportResult> {
  const data = importPayloadSchema.parse(payload);
  // Cifrado fuera de la transacción: expo-sqlite no admite await dentro de
  // withTransactionSync (#182).
  const [encryptedFlights, encryptedAccommodations, encryptedActivities, encryptedDocuments] =
    await Promise.all([
      encryptImportFlights(data.flights),
      encryptImportAccommodations(data.accommodations),
      encryptImportActivities(data.activities),
      encryptImportDocuments(data.documents),
    ]);
  let result: ImportResult = { flights: 0, accommodations: 0, activities: 0, expenses: 0, packing: 0, documents: 0 };
  db.withTransactionSync(() => {
    result = {
      flights:        bulkCreateFlights(tripId, encryptedFlights),
      accommodations: bulkCreateAccommodations(tripId, encryptedAccommodations),
      activities:     bulkCreateActivities(tripId, encryptedActivities),
      expenses:       bulkCreateExpenses(tripId, data.expenses),
      packing:        bulkCreatePackingItems(tripId, data.packing),
      documents:      bulkCreateDocuments(tripId, encryptedDocuments),
    };
  });
  return result;
}

// ─── Duplicate detection ──────────────────────────────────────────────────────
// Port of the web app fuzzy-matching logic. Kept in sync with
// apps/web/src/actions/import.ts — any change to the algorithm goes in both.

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = temp;
    }
  }
  return dp[n];
}

function isFuzzyMatch(a: string, b: string, threshold = 0.85): boolean {
  const na = normalize(a).split(" ").sort().join(" ");
  const nb = normalize(b).split(" ").sort().join(" ");
  if (na === nb) return true;
  const maxLen = Math.max(na.length, nb.length);
  return maxLen > 0 && 1 - levenshtein(na, nb) / maxLen >= threshold;
}

const isoDay = (s: string) => s.slice(0, 10);

export interface DuplicateFlags {
  flights:        boolean[];
  accommodations: boolean[];
  activities:     boolean[];
  expenses:       boolean[];
  packing:        boolean[];
  documents:      boolean[];
}

export async function checkDuplicates(
  tripId: number,
  payload: ImportPayload
): Promise<DuplicateFlags> {
  const data = importPayloadSchema.parse(payload);

  type ExistingFlight = { flight_number: string | null; departure_at: string | null };
  type ExistingAccom  = { name: string; check_in: string | null };
  type ExistingAct    = { name: string; scheduled_at: string | null };
  type ExistingExp    = { description: string; amount: number; date: string };
  type ExistingPack   = { name: string; category: string };
  type ExistingDoc    = { name: string; type: string };

  const existingFlights: ExistingFlight[] = data.flights.length > 0
    ? db.getAllSync<ExistingFlight>(
        "SELECT flight_number, departure_at FROM flights WHERE trip_id = ?", [tripId]
      ) : [];
  const existingAccoms: ExistingAccom[] = data.accommodations.length > 0
    ? db.getAllSync<ExistingAccom>(
        "SELECT name, check_in FROM accommodations WHERE trip_id = ?", [tripId]
      ) : [];
  const existingActs: ExistingAct[] = data.activities.length > 0
    ? db.getAllSync<ExistingAct>(
        "SELECT name, scheduled_at FROM activities WHERE trip_id = ?", [tripId]
      ) : [];
  const existingExp: ExistingExp[] = data.expenses.length > 0
    ? db.getAllSync<ExistingExp>(
        "SELECT description, amount, date FROM expenses WHERE trip_id = ?", [tripId]
      ) : [];
  const existingPacking: ExistingPack[] = data.packing.length > 0
    ? db.getAllSync<ExistingPack>(
        "SELECT name, category FROM packing_items WHERE trip_id = ?", [tripId]
      ) : [];
  const existingDocsEncrypted: ExistingDoc[] = data.documents.length > 0
    ? db.getAllSync<ExistingDoc>(
        "SELECT name, type FROM documents WHERE trip_id = ?", [tripId]
      ) : [];
  const existingDocs: ExistingDoc[] = await Promise.all(
    existingDocsEncrypted.map(async (d) => ({ ...d, name: await decryptText(d.name) }))
  );

  return {
    flights: data.flights.map((f) =>
      existingFlights.some((e) => {
        if (e.flight_number && f.flightNumber) {
          return (
            normalize(e.flight_number) === normalize(f.flightNumber) &&
            (!e.departure_at || !f.departureAt ||
              isoDay(e.departure_at) === isoDay(f.departureAt))
          );
        }
        return !e.departure_at || !f.departureAt ||
          isoDay(e.departure_at) === isoDay(f.departureAt);
      })
    ),
    accommodations: data.accommodations.map((a) =>
      existingAccoms.some(
        (e) =>
          isFuzzyMatch(e.name, a.name) &&
          (!e.check_in || !a.checkIn || isoDay(e.check_in) === isoDay(a.checkIn))
      )
    ),
    activities: data.activities.map((act) =>
      existingActs.some(
        (e) =>
          isFuzzyMatch(e.name, act.name) &&
          (!act.scheduledAt || !e.scheduled_at ||
            isoDay(e.scheduled_at) === isoDay(act.scheduledAt))
      )
    ),
    expenses: data.expenses.map((exp) =>
      existingExp.some(
        (e) =>
          isFuzzyMatch(e.description, exp.description) &&
          e.amount === exp.amount &&
          isoDay(e.date) === isoDay(exp.date)
      )
    ),
    packing: data.packing.map((p) =>
      existingPacking.some(
        (e) =>
          isFuzzyMatch(e.name, p.name) &&
          normalize(e.category) === normalize(p.category)
      )
    ),
    documents: data.documents.map((d) =>
      existingDocs.some(
        (e) => isFuzzyMatch(e.name, d.name) && normalize(e.type) === normalize(d.type)
      )
    ),
  };
}
