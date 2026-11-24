import "server-only";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { geocodeAccommodation, geocodeActivity, geocodeDiveSite } from "@/lib/geocode-items";
import type { Actor } from "@/lib/services/actor";
import { requireTrip } from "@/lib/services/access";
import { AUDIT_RETENTION_MS, type Db } from "@/lib/services/audit";
import { NotFoundError } from "@/lib/services/errors";
import { reorderDestinations, revalidateDestinationPaths } from "@/lib/services/destinations";
import { resolveConversion } from "@/lib/services/expenses";

// Restaurar, from the register of the profile: the user brings back what one of
// their agents deleted, with its id and its data, for 90 days. The owner is
// always the actor's: a trip element goes back only to a trip of the user that
// still exists, and a diving one is created for the actor, whatever the
// snapshot says. The entry is marked in the same transaction, conditioned on
// not being marked yet, so it can't be restored twice.

type Data = Record<string, unknown>;
type Owner = { readonly userId: string; readonly trip: { readonly id: string; readonly currency: string } | null };

type Restorer = {
  readonly inTrip: boolean;
  readonly create: (db: Db, data: Data, owner: Owner) => Promise<unknown>;
  // What the creation of the element sets off, after the transaction.
  readonly after: (data: Data, owner: Owner) => Promise<void> | void;
};

const tripId = (owner: Owner) => owner.trip?.id ?? "";
const unplaced = (data: Data) => data.latitude === null || data.latitude === undefined;
const section = (path: string) => (_: Data, owner: Owner) => revalidatePath(`/trips/${tripId(owner)}/${path}`);
const dives = () => revalidatePath("/dives");

const RESTORERS: Readonly<Record<string, Restorer>> = {
  Destination: {
    inTrip: true,
    create: (db, data) => db.destination.create({ data: data as Prisma.DestinationUncheckedCreateInput }),
    after: async (_, owner) => {
      await reorderDestinations(tripId(owner));
      revalidateDestinationPaths(tripId(owner));
    },
  },
  Flight: {
    inTrip: true,
    create: (db, data) => db.flight.create({ data: data as Prisma.FlightUncheckedCreateInput }),
    after: section("flights"),
  },
  Accommodation: {
    inTrip: true,
    create: (db, data) => db.accommodation.create({ data: data as Prisma.AccommodationUncheckedCreateInput }),
    after: (data, owner) => {
      if (unplaced(data)) void geocodeAccommodation(String(data.id));
      section("accommodations")(data, owner);
    },
  },
  Activity: {
    inTrip: true,
    create: (db, data) => db.activity.create({ data: data as Prisma.ActivityUncheckedCreateInput }),
    after: (data, owner) => {
      if (unplaced(data)) void geocodeActivity(String(data.id));
      section("activities")(data, owner);
    },
  },
  Document: {
    inTrip: true,
    create: (db, data) => db.document.create({ data: data as Prisma.DocumentUncheckedCreateInput }),
    after: section("documents"),
  },
  // Converted again against the trip's currency of today.
  Expense: {
    inTrip: true,
    create: (db, data) => db.expense.create({ data: data as Prisma.ExpenseUncheckedCreateInput }),
    after: async (data, owner) => {
      if (owner.trip) {
        const conversion = await resolveConversion(String(data.currency), owner.trip.currency, Number(data.amount));
        await prisma.expense.update({ where: { id: String(data.id), tripId: owner.trip.id }, data: conversion });
      }
      section("expenses")(data, owner);
    },
  },
  Task: {
    inTrip: true,
    create: (db, data) => db.task.create({ data: data as Prisma.TaskUncheckedCreateInput }),
    after: section("tasks"),
  },
  // A suitcase deleted since then leaves it in no bag, as its deletion would have.
  "Packing item": {
    inTrip: true,
    create: async (db, data, owner) => {
      const bag = typeof data.suitcaseId === "string" ? data.suitcaseId : null;
      const suitcase = bag ? await db.suitcase.findFirst({ where: { id: bag, tripId: tripId(owner) }, select: { id: true } }) : null;
      const placed: Data = { ...data, suitcaseId: suitcase?.id ?? null };
      return db.packingItem.create({ data: placed as Prisma.PackingItemUncheckedCreateInput });
    },
    after: section("packing"),
  },
  // An area deleted since then leaves it without one, as its deletion would have.
  "Dive site": {
    inTrip: false,
    create: async (db, data, owner) => {
      const areaId = typeof data.diveAreaId === "string" ? data.diveAreaId : null;
      const area = areaId
        ? await db.diveArea.findFirst({ where: { id: areaId, userId: owner.userId }, select: { id: true } })
        : null;
      const placed: Data = { ...data, diveAreaId: area?.id ?? null };
      return db.diveSite.create({ data: placed as Prisma.DiveSiteUncheckedCreateInput });
    },
    after: (data) => {
      if (unplaced(data)) void geocodeDiveSite(String(data.id));
      dives();
    },
  },
  "Dive area": {
    inTrip: false,
    create: (db, data) => db.diveArea.create({ data: data as Prisma.DiveAreaUncheckedCreateInput }),
    after: dives,
  },
  Equipment: {
    inTrip: false,
    create: (db, data) => db.diveEquipment.create({ data: data as Prisma.DiveEquipmentUncheckedCreateInput }),
    after: dives,
  },
  // Its equipment has to be there, and the user's.
  "Equipment service": {
    inTrip: false,
    create: async (db, data, owner) => {
      const equipmentId = typeof data.equipmentId === "string" ? data.equipmentId : "";
      const equipment = await db.diveEquipment.findFirst({ where: { id: equipmentId, userId: owner.userId }, select: { id: true } });
      if (!equipment) throw new NotFoundError("Equipment");
      return db.diveEquipmentService.create({ data: data as Prisma.DiveEquipmentServiceUncheckedCreateInput });
    },
    after: (data) => revalidatePath(`/dives/equipment/${String(data.equipmentId)}`),
  },
  Certification: {
    inTrip: false,
    create: (db, data) => db.diveCertification.create({ data: data as Prisma.DiveCertificationUncheckedCreateInput }),
    after: dives,
  },
};

function snapshotOf(snapshot: Prisma.JsonValue | null, entityId: string): Data | null {
  if (typeof snapshot !== "object" || snapshot === null || Array.isArray(snapshot)) return null;
  return snapshot.id === entityId ? { ...snapshot } : null;
}

// NotFoundError("Register entry") when there is nothing to restore (someone
// else's entry, already restored, older than 90 days); NotFoundError("Trip")
// or ("Equipment") when what it belonged to no longer exists.
export async function restoreDeletion(actor: Actor, entryId: string): Promise<void> {
  const where = {
    id: entryId,
    userId: actor.userId,
    action: "DELETED" as const,
    restoredAt: null,
    createdAt: { gte: new Date(Date.now() - AUDIT_RETENTION_MS) },
  };
  const entry = await prisma.agentAuditEntry.findFirst({ where });
  const restorer = entry ? RESTORERS[entry.entityType] : undefined;
  const snapshot = entry ? snapshotOf(entry.snapshot, entry.entityId) : null;
  if (!entry || !restorer || !snapshot) throw new NotFoundError("Register entry");

  let trip: Owner["trip"] = null;
  if (restorer.inTrip) {
    if (typeof snapshot.tripId !== "string") throw new NotFoundError("Register entry");
    trip = await requireTrip(actor, snapshot.tripId);
  }
  const owner: Owner = { userId: actor.userId, trip };
  // A write of the user: it doesn't carry an agent's mark.
  const data: Data = {
    ...snapshot,
    agentGrantId: null,
    ...(trip ? { tripId: trip.id } : { userId: actor.userId }),
  };

  await prisma.$transaction(async (tx) => {
    const marked = await tx.agentAuditEntry.updateMany({ where, data: { restoredAt: new Date() } });
    if (marked.count !== 1) throw new NotFoundError("Register entry");
    await restorer.create(tx, data, owner);
  });
  await restorer.after(data, owner);
}
