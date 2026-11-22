"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { DEFAULT_PACKING_ITEMS, foldText } from "@tripplanner/shared";
import { prisma } from "@/lib/prisma";
import { idListSchema, idSchema, nullableIdSchema, packingItemSchema as itemSchema } from "@/lib/schemas";
import { requireSuitcaseInTrip, requireTripOwner, requireUser } from "@/lib/action-auth";
import { ensureSuitcases } from "@/lib/suitcases";

const DIVE_EQUIPMENT_PACKING_CATEGORY = "Buceo";

export async function createPackingItem(tripId: string, formData: FormData) {
  await requireTripOwner(tripId);
  const data = itemSchema.parse(Object.fromEntries(formData));
  await requireSuitcaseInTrip(tripId, data.suitcaseId);
  await prisma.packingItem.create({ data: { tripId, ...data } });
  revalidatePath(`/trips/${tripId}/packing`);
}

// Moving an item to another bag unpacks it: it isn't in the new bag yet.
export async function updatePackingItem(tripId: string, id: string, formData: FormData) {
  await requireTripOwner(tripId);
  const itemId = idSchema.parse(id);
  const data = itemSchema.parse(Object.fromEntries(formData));
  const current = await prisma.packingItem.findFirst({ where: { id: itemId, tripId }, select: { suitcaseId: true } });
  if (!current) throw new Error("Packing item not found in this trip");
  await requireSuitcaseInTrip(tripId, data.suitcaseId);
  await prisma.packingItem.update({
    where: { id: itemId, tripId },
    data: current.suitcaseId === data.suitcaseId ? data : { ...data, packed: false },
  });
  revalidatePath(`/trips/${tripId}/packing`);
}

export async function togglePackingItem(tripId: string, id: string, packed: boolean) {
  await requireTripOwner(tripId);
  await prisma.packingItem.update({ where: { id, tripId }, data: { packed } });
  revalidatePath(`/trips/${tripId}/packing`);
}

export async function deletePackingItem(tripId: string, id: string) {
  await requireTripOwner(tripId);
  await prisma.packingItem.delete({ where: { id, tripId } });
  revalidatePath(`/trips/${tripId}/packing`);
}

export async function addDefaultPackingItems(tripId: string, suitcaseId: string | null = null) {
  await requireTripOwner(tripId);
  const target = nullableIdSchema.parse(suitcaseId);
  await requireSuitcaseInTrip(tripId, target);
  await prisma.packingItem.createMany({
    data: DEFAULT_PACKING_ITEMS.map((d) => ({ tripId, ...d, quantity: 1, packed: false, suitcaseId: target })),
    skipDuplicates: true,
  });
  revalidatePath(`/trips/${tripId}/packing`);
}

// Items already on the list keep their bag: only the new ones go to `suitcaseId`.
export async function addDiveEquipmentToPackingList(
  tripId: string,
  suitcaseId: string | null = null,
): Promise<{ added: number }> {
  const userId = await requireUser();
  await requireTripOwner(tripId);
  const target = nullableIdSchema.parse(suitcaseId);
  await requireSuitcaseInTrip(tripId, target);

  const [equipment, existingItems] = await Promise.all([
    prisma.diveEquipment.findMany({ where: { userId, status: "OWNED" }, select: { name: true } }),
    prisma.packingItem.findMany({ where: { tripId }, select: { name: true } }),
  ]);

  const existingNames = new Set(existingItems.map((i) => i.name.trim().toLowerCase()));
  const toAdd = equipment.filter((e) => !existingNames.has(e.name.trim().toLowerCase()));
  if (toAdd.length === 0) return { added: 0 };

  await prisma.packingItem.createMany({
    data: toAdd.map((e) => ({
      tripId,
      name: e.name,
      category: DIVE_EQUIPMENT_PACKING_CATEGORY,
      quantity: 1,
      packed: false,
      suitcaseId: target,
    })),
  });

  revalidatePath(`/trips/${tripId}/packing`);
  return { added: toAdd.length };
}

// ─── Bulk actions ─────────────────────────────────────────────────────────────
// Every where carries tripId: an id from another trip mixed into the list is
// left untouched.

// Only the items that actually change bag are touched (and unpacked). In SQL
// `suitcaseId <> x` is never true for NULL, hence the explicit OR.
export async function movePackingItems(tripId: string, ids: string[], suitcaseId: string | null) {
  await requireTripOwner(tripId);
  const itemIds = idListSchema.parse(ids);
  const target = nullableIdSchema.parse(suitcaseId);
  await requireSuitcaseInTrip(tripId, target);
  await prisma.packingItem.updateMany({
    where: {
      id: { in: itemIds },
      tripId,
      ...(target === null
        ? { suitcaseId: { not: null } }
        : { OR: [{ suitcaseId: null }, { suitcaseId: { not: target } }] }),
    },
    data: { suitcaseId: target, packed: false },
  });
  revalidatePath(`/trips/${tripId}/packing`);
}

export async function deletePackingItems(tripId: string, ids: string[]) {
  await requireTripOwner(tripId);
  const itemIds = idListSchema.parse(ids);
  await prisma.packingItem.deleteMany({ where: { id: { in: itemIds }, tripId } });
  revalidatePath(`/trips/${tripId}/packing`);
}

export async function setPackedPackingItems(tripId: string, ids: string[], packed: boolean) {
  await requireTripOwner(tripId);
  const itemIds = idListSchema.parse(ids);
  const value = z.boolean().parse(packed);
  await prisma.packingItem.updateMany({ where: { id: { in: itemIds }, tripId }, data: { packed: value } });
  revalidatePath(`/trips/${tripId}/packing`);
}

// undefined: the whole trip; null: the items with no bag; an id: that bag.
export async function unpackAllPackingItems(tripId: string, suitcaseId?: string | null) {
  await requireTripOwner(tripId);
  const target = nullableIdSchema.optional().parse(suitcaseId);
  if (target) await requireSuitcaseInTrip(tripId, target);
  await prisma.packingItem.updateMany({ where: { tripId, suitcaseId: target, packed: true }, data: { packed: false } });
  revalidatePath(`/trips/${tripId}/packing`);
}

// Copies the source trip's bags (name and type, no weight: it is what this trip
// weighs that matters) and items into this trip, unpacked. A bag whose folded
// name already exists here is reused. The source trip is only read.
export async function copyPackingFromTrip(
  tripId: string,
  sourceTripId: string,
): Promise<{ suitcases: number; items: number }> {
  const sourceId = idSchema.parse(sourceTripId);
  if (sourceId === tripId) throw new Error("Cannot copy a trip onto itself");
  await requireTripOwner(tripId);
  await requireTripOwner(sourceId);

  const result = await prisma.$transaction(async (tx) => {
    const [sourceSuitcases, sourceItems] = await Promise.all([
      tx.suitcase.findMany({
        where: { tripId: sourceId },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, type: true },
      }),
      tx.packingItem.findMany({
        where: { tripId: sourceId },
        select: { name: true, category: true, quantity: true, suitcaseId: true },
      }),
    ]);

    const { ids, created } = await ensureSuitcases(tx, tripId, sourceSuitcases);
    const nameBySourceId = new Map(sourceSuitcases.map((s) => [s.id, foldText(s.name)]));
    const targetId = (sourceSuitcaseId: string | null) => {
      const key = sourceSuitcaseId === null ? undefined : nameBySourceId.get(sourceSuitcaseId);
      return key === undefined ? null : (ids.get(key) ?? null);
    };

    const { count } = sourceItems.length > 0
      ? await tx.packingItem.createMany({
          data: sourceItems.map((i) => ({
            tripId,
            name: i.name,
            category: i.category,
            quantity: i.quantity,
            packed: false,
            suitcaseId: targetId(i.suitcaseId),
          })),
        })
      : { count: 0 };
    return { suitcases: created, items: count };
  });

  revalidatePath(`/trips/${tripId}/packing`);
  return result;
}
