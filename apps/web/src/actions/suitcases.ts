"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { idSchema, suitcaseSchema } from "@/lib/schemas";
import { requireSuitcaseInTrip, requireTripOwner } from "@/lib/action-auth";

export type SuitcaseInput = z.input<typeof suitcaseSchema>;

const deleteModeSchema = z.enum(["unassign", "deleteItems"]);

export async function createSuitcase(tripId: string, input: SuitcaseInput) {
  await requireTripOwner(tripId);
  const data = suitcaseSchema.parse(input);
  await prisma.suitcase.create({ data: { tripId, ...data } });
  revalidatePath(`/trips/${tripId}/packing`);
}

export async function updateSuitcase(tripId: string, id: string, input: SuitcaseInput) {
  await requireTripOwner(tripId);
  const suitcaseId = idSchema.parse(id);
  const data = suitcaseSchema.parse(input);
  await requireSuitcaseInTrip(tripId, suitcaseId);
  await prisma.suitcase.update({ where: { id: suitcaseId, tripId }, data });
  revalidatePath(`/trips/${tripId}/packing`);
}

// "unassign" leaves the bag's items in "no bag", unpacked: they are no longer
// in any bag. "deleteItems" deletes them along with the bag.
export async function deleteSuitcase(tripId: string, id: string, mode: "unassign" | "deleteItems") {
  await requireTripOwner(tripId);
  const suitcaseId = idSchema.parse(id);
  const deleteMode = deleteModeSchema.parse(mode);
  await requireSuitcaseInTrip(tripId, suitcaseId);
  await prisma.$transaction(async (tx) => {
    if (deleteMode === "unassign") {
      await tx.packingItem.updateMany({
        where: { suitcaseId, tripId },
        data: { suitcaseId: null, packed: false, agentGrantId: null },
      });
    } else {
      await tx.packingItem.deleteMany({ where: { suitcaseId, tripId } });
    }
    await tx.suitcase.delete({ where: { id: suitcaseId, tripId } });
  });
  revalidatePath(`/trips/${tripId}/packing`);
}
