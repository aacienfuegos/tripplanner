"use server";

// ─── Future-proofing note ─────────────────────────────────────────────────────
// Data arrays are typed with Prisma.X CreateManyInput so that tsc --noEmit fails
// immediately if a new non-nullable field is added to a model in schema.prisma.
// The pre-commit hook runs tsc, so model changes can't silently break this action.
// If you add a new section to the app, also update:
//   src/lib/import-schemas.ts, src/lib/import-prompt.ts, ReviewStep.tsx
// ─────────────────────────────────────────────────────────────────────────────

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { importPayloadSchema, ImportPayload } from "@/lib/import-schemas";

async function requireTripOwner(tripId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { userId: true } });
  if (!trip || trip.userId !== session.user.id) redirect("/trips");
}

export type ImportResult = {
  flights: number;
  accommodations: number;
  activities: number;
  expenses: number;
  packing: number;
  documents: number;
};

export async function bulkImport(tripId: string, payload: ImportPayload): Promise<ImportResult> {
  await requireTripOwner(tripId);
  const data = importPayloadSchema.parse(payload);

  const counts = await prisma.$transaction(async (tx) => {
    const result: ImportResult = {
      flights: 0, accommodations: 0, activities: 0,
      expenses: 0, packing: 0, documents: 0,
    };

    if (data.flights.length > 0) {
      const rows: Prisma.FlightCreateManyInput[] = data.flights.map((f) => ({
        tripId,
        airline:         f.airline,
        flightNumber:    f.flightNumber,
        origin:          f.origin,
        destination:     f.destination,
        departureAt:     new Date(f.departureAt),
        arrivalAt:       new Date(f.arrivalAt),
        bookingRef:      f.bookingRef ?? null,
        confirmationUrl: f.confirmationUrl || null,
        seatNumber:      f.seatNumber ?? null,
        class:           f.class,
        price:           f.price ?? null,
        notes:           f.notes ?? null,
      }));
      const { count } = await tx.flight.createMany({ data: rows });
      result.flights = count;
    }

    if (data.accommodations.length > 0) {
      const rows: Prisma.AccommodationCreateManyInput[] = data.accommodations.map((a) => ({
        tripId,
        name:            a.name,
        type:            a.type,
        address:         a.address ?? null,
        city:            a.city,
        checkIn:         new Date(a.checkIn),
        checkOut:        new Date(a.checkOut),
        bookingRef:      a.bookingRef ?? null,
        confirmationUrl: a.confirmationUrl || null,
        price:           a.price ?? null,
        pricePerNight:   a.pricePerNight ?? null,
        notes:           a.notes ?? null,
      }));
      const { count } = await tx.accommodation.createMany({ data: rows });
      result.accommodations = count;
    }

    if (data.activities.length > 0) {
      const rows: Prisma.ActivityCreateManyInput[] = data.activities.map((act) => ({
        tripId,
        name:            act.name,
        type:            act.type,
        description:     act.description ?? null,
        location:        act.location ?? null,
        city:            act.city ?? null,
        scheduledAt:     act.scheduledAt ? new Date(act.scheduledAt) : null,
        duration:        act.duration ?? null,
        bookingRef:      act.bookingRef ?? null,
        confirmationUrl: act.confirmationUrl || null,
        price:           act.price ?? null,
        status:          act.status,
        notes:           act.notes ?? null,
      }));
      const { count } = await tx.activity.createMany({ data: rows });
      result.activities = count;
    }

    if (data.expenses.length > 0) {
      const rows: Prisma.ExpenseCreateManyInput[] = data.expenses.map((e) => ({
        tripId,
        description: e.description,
        category:    e.category,
        amount:      e.amount,
        currency:    e.currency,
        date:        new Date(e.date),
        paid:        e.paid,
        notes:       e.notes ?? null,
      }));
      const { count } = await tx.expense.createMany({ data: rows });
      result.expenses = count;
    }

    if (data.packing.length > 0) {
      const rows: Prisma.PackingItemCreateManyInput[] = data.packing.map((p) => ({
        tripId,
        name:     p.name,
        category: p.category,
        quantity: p.quantity,
      }));
      const { count } = await tx.packingItem.createMany({ data: rows });
      result.packing = count;
    }

    if (data.documents.length > 0) {
      const rows: Prisma.DocumentCreateManyInput[] = data.documents.map((d) => ({
        tripId,
        name:      d.name,
        type:      d.type,
        expiresAt: d.expiresAt ? new Date(d.expiresAt) : null,
        notes:     d.notes ?? null,
      }));
      const { count } = await tx.document.createMany({ data: rows });
      result.documents = count;
    }

    return result;
  });

  revalidatePath(`/trips/${tripId}`);
  for (const section of ["flights", "accommodations", "activities", "expenses", "packing", "documents"]) {
    revalidatePath(`/trips/${tripId}/${section}`);
  }

  return counts;
}

// ─── Duplicate detection ──────────────────────────────────────────────────────

// Strips diacritics, punctuation, and extra whitespace for consistent comparison.
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

// Sorts words before comparing so "Hotel Marriott" ≈ "Marriott Hotel",
// then applies Levenshtein for typos and minor AI variations.
function isFuzzyMatch(a: string, b: string, threshold = 0.85): boolean {
  const na = normalize(a).split(" ").sort().join(" ");
  const nb = normalize(b).split(" ").sort().join(" ");
  if (na === nb) return true;
  const maxLen = Math.max(na.length, nb.length);
  return maxLen > 0 && 1 - levenshtein(na, nb) / maxLen >= threshold;
}

export type DuplicateFlags = {
  flights:        boolean[];
  accommodations: boolean[];
  activities:     boolean[];
  expenses:       boolean[];
  packing:        boolean[];
  documents:      boolean[];
};

export async function checkDuplicates(
  tripId: string,
  payload: ImportPayload,
): Promise<DuplicateFlags> {
  await requireTripOwner(tripId);
  const data = importPayloadSchema.parse(payload);

  // Use local-time components so the comparison is consistent with how
  // new Date("2024-06-15T07:30:00") was parsed (local time) when storing.
  // toISOString() returns UTC and would give the wrong day in non-UTC timezones.
  const localDay = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const isoDay = (s: string) => s.slice(0, 10);

  const [existingFlights, existingAccoms, existingActs, existingExp, existingPacking, existingDocs] =
    await Promise.all([
      data.flights.length > 0
        ? prisma.flight.findMany({ where: { tripId }, select: { flightNumber: true, departureAt: true } })
        : [],
      data.accommodations.length > 0
        ? prisma.accommodation.findMany({ where: { tripId }, select: { name: true, checkIn: true } })
        : [],
      data.activities.length > 0
        ? prisma.activity.findMany({ where: { tripId }, select: { name: true, scheduledAt: true } })
        : [],
      data.expenses.length > 0
        ? prisma.expense.findMany({ where: { tripId }, select: { description: true, amount: true, date: true } })
        : [],
      data.packing.length > 0
        ? prisma.packingItem.findMany({ where: { tripId }, select: { name: true, category: true } })
        : [],
      data.documents.length > 0
        ? prisma.document.findMany({ where: { tripId }, select: { name: true, type: true } })
        : [],
    ]);

  return {
    // Flight numbers must match exactly after normalization — "IB1234" ≠ "IB1235"
    flights: data.flights.map((f) =>
      existingFlights.some(
        (e) =>
          normalize(e.flightNumber) === normalize(f.flightNumber) &&
          localDay(e.departureAt) === isoDay(f.departureAt),
      ),
    ),
    accommodations: data.accommodations.map((a) =>
      existingAccoms.some(
        (e) =>
          isFuzzyMatch(e.name, a.name) &&
          localDay(e.checkIn) === isoDay(a.checkIn),
      ),
    ),
    activities: data.activities.map((act) =>
      existingActs.some(
        (e) =>
          isFuzzyMatch(e.name, act.name) &&
          (!act.scheduledAt || !e.scheduledAt ||
            localDay(e.scheduledAt) === isoDay(act.scheduledAt)),
      ),
    ),
    expenses: data.expenses.map((exp) =>
      existingExp.some(
        (e) =>
          isFuzzyMatch(e.description, exp.description) &&
          e.amount === exp.amount &&
          localDay(e.date) === isoDay(exp.date),
      ),
    ),
    packing: data.packing.map((p) =>
      existingPacking.some(
        (e) =>
          isFuzzyMatch(e.name, p.name) &&
          normalize(e.category) === normalize(p.category),
      ),
    ),
    documents: data.documents.map((d) =>
      existingDocs.some(
        (e) =>
          isFuzzyMatch(e.name, d.name) && normalize(e.type) === normalize(d.type),
      ),
    ),
  };
}
