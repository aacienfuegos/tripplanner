"use server";

import { revalidatePath } from "next/cache";
import { foldText } from "@tripplanner/shared";
import { prisma } from "@/lib/prisma";
import { idSchema, packingItemSchema as itemSchema } from "@/lib/schemas";
import { requireTripOwner } from "@/lib/action-auth";
import { ensureSuitcases } from "@/lib/suitcases";
import { redirectIfTripNotFound, webActor } from "@/lib/services/actor";
import * as packing from "@/lib/services/packing";

function parseItem(formData: FormData) {
  const { suitcaseId, ...item } = itemSchema.parse(Object.fromEntries(formData));
  return { item, suitcaseId };
}

export async function createPackingItem(tripId: string, formData: FormData) {
  const actor = await webActor();
  const { item, suitcaseId } = parseItem(formData);
  await redirectIfTripNotFound(packing.createPackingItem(actor, tripId, item, suitcaseId));
}

export async function updatePackingItem(tripId: string, id: string, formData: FormData) {
  const actor = await webActor();
  const { item, suitcaseId } = parseItem(formData);
  await redirectIfTripNotFound(packing.updatePackingItem(actor, tripId, id, item, suitcaseId));
}

export async function togglePackingItem(tripId: string, id: string, packed: boolean) {
  const actor = await webActor();
  await redirectIfTripNotFound(packing.togglePackingItem(actor, tripId, id, packed));
}

export async function deletePackingItem(tripId: string, id: string) {
  const actor = await webActor();
  await redirectIfTripNotFound(packing.deletePackingItem(actor, tripId, id));
}

export async function addDefaultPackingItems(tripId: string, suitcaseId: string | null = null) {
  const actor = await webActor();
  await redirectIfTripNotFound(packing.addDefaultPackingItems(actor, tripId, suitcaseId));
}

export async function addDiveEquipmentToPackingList(
  tripId: string,
  suitcaseId: string | null = null,
): Promise<{ added: number }> {
  const actor = await webActor();
  return redirectIfTripNotFound(packing.addDiveEquipmentToPackingList(actor, tripId, suitcaseId));
}

export async function movePackingItems(tripId: string, ids: string[], suitcaseId: string | null) {
  const actor = await webActor();
  await redirectIfTripNotFound(packing.movePackingItems(actor, tripId, ids, suitcaseId));
}

export async function deletePackingItems(tripId: string, ids: string[]) {
  const actor = await webActor();
  await redirectIfTripNotFound(packing.deletePackingItems(actor, tripId, ids));
}

export async function setPackedPackingItems(tripId: string, ids: string[], packed: boolean) {
  const actor = await webActor();
  await redirectIfTripNotFound(packing.setPackedPackingItems(actor, tripId, ids, packed));
}

export async function unpackAllPackingItems(tripId: string, suitcaseId?: string | null) {
  const actor = await webActor();
  await redirectIfTripNotFound(packing.unpackAllPackingItems(actor, tripId, suitcaseId));
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
