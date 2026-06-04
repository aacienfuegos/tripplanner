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

  const dateStr = (d: Date) => d.toISOString().slice(0, 10);
  const isoDay  = (s: string) => s.slice(0, 10);

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
    flights: data.flights.map((f) =>
      existingFlights.some(
        (e) =>
          e.flightNumber.toLowerCase() === f.flightNumber.toLowerCase() &&
          dateStr(e.departureAt) === isoDay(f.departureAt),
      ),
    ),
    accommodations: data.accommodations.map((a) =>
      existingAccoms.some(
        (e) =>
          e.name.toLowerCase() === a.name.toLowerCase() &&
          dateStr(e.checkIn) === isoDay(a.checkIn),
      ),
    ),
    activities: data.activities.map((act) =>
      existingActs.some(
        (e) =>
          e.name.toLowerCase() === act.name.toLowerCase() &&
          (!act.scheduledAt || !e.scheduledAt ||
            dateStr(e.scheduledAt) === isoDay(act.scheduledAt)),
      ),
    ),
    expenses: data.expenses.map((exp) =>
      existingExp.some(
        (e) =>
          e.description.toLowerCase() === exp.description.toLowerCase() &&
          e.amount === exp.amount &&
          dateStr(e.date) === isoDay(exp.date),
      ),
    ),
    packing: data.packing.map((p) =>
      existingPacking.some(
        (e) =>
          e.name.toLowerCase() === p.name.toLowerCase() &&
          e.category.toLowerCase() === p.category.toLowerCase(),
      ),
    ),
    documents: data.documents.map((d) =>
      existingDocs.some(
        (e) =>
          e.name.toLowerCase() === d.name.toLowerCase() && e.type === d.type,
      ),
    ),
  };
}
