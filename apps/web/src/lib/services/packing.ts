import "server-only";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { DEFAULT_PACKING_ITEMS } from "@tripplanner/shared";
import { prisma } from "@/lib/prisma";
import { idListSchema, idSchema, nullableIdSchema } from "@/lib/schemas";
import { packingItemInputSchema, type PackingItemInput } from "@/lib/agent-schemas";
import type { Actor } from "@/lib/services/actor";
import { requireSuitcase, requireTrip } from "@/lib/services/access";
import { NotFoundError, orNotFound, parseInput } from "@/lib/services/errors";

const DIVE_EQUIPMENT_PACKING_CATEGORY = "Buceo";

// The bag is the web's to choose: an agent's items go to "no bag" and its edits
// leave the bag as it was, whatever suitcaseId comes with them.
const webBag = (actor: Actor, suitcaseId: string | null | undefined) =>
  actor.kind === "web" ? suitcaseId : undefined;

function revalidatePacking(tripId: string) {
  revalidatePath(`/trips/${tripId}/packing`);
}

export async function createPackingItem(
  actor: Actor,
  tripId: string,
  input: PackingItemInput,
  suitcaseId: string | null = null,
) {
  await requireTrip(actor, tripId);
  const data = parseInput(packingItemInputSchema, input);
  const target = webBag(actor, nullableIdSchema.parse(suitcaseId)) ?? null;
  await requireSuitcase(tripId, target);
  const created = await prisma.packingItem.create({ data: { ...data, tripId, suitcaseId: target } });
  revalidatePacking(tripId);
  return created;
}

// Moving an item to another bag unpacks it: it isn't in the new bag yet.
export async function updatePackingItem(
  actor: Actor,
  tripId: string,
  id: string,
  input: Partial<PackingItemInput>,
  suitcaseId?: string | null,
) {
  await requireTrip(actor, tripId);
  const itemId = idSchema.parse(id);
  const data = parseInput(packingItemInputSchema.partial(), input);
  const current = await prisma.packingItem.findFirst({ where: { id: itemId, tripId }, select: { suitcaseId: true } });
  if (!current) throw new NotFoundError("Packing item");
  const requested = webBag(actor, nullableIdSchema.optional().parse(suitcaseId));
  const target = requested === undefined ? current.suitcaseId : requested;
  await requireSuitcase(tripId, target);
  await prisma.packingItem.update({
    where: { id: itemId, tripId },
    data: current.suitcaseId === target ? { ...data, suitcaseId: target } : { ...data, suitcaseId: target, packed: false },
  });
  revalidatePacking(tripId);
}

export async function togglePackingItem(actor: Actor, tripId: string, id: string, packed: boolean) {
  await requireTrip(actor, tripId);
  await orNotFound("Packing item", prisma.packingItem.update({ where: { id, tripId }, data: { packed } }));
  revalidatePacking(tripId);
}

export async function deletePackingItem(actor: Actor, tripId: string, id: string) {
  await requireTrip(actor, tripId);
  await orNotFound("Packing item", prisma.packingItem.delete({ where: { id, tripId } }));
  revalidatePacking(tripId);
}

export async function addDefaultPackingItems(actor: Actor, tripId: string, suitcaseId: string | null = null) {
  await requireTrip(actor, tripId);
  const target = webBag(actor, nullableIdSchema.parse(suitcaseId)) ?? null;
  await requireSuitcase(tripId, target);
  await prisma.packingItem.createMany({
    data: DEFAULT_PACKING_ITEMS.map((d) => ({ tripId, ...d, quantity: 1, packed: false, suitcaseId: target })),
    skipDuplicates: true,
  });
  revalidatePacking(tripId);
}

// Items already on the list keep their bag: only the new ones go to `suitcaseId`.
export async function addDiveEquipmentToPackingList(
  actor: Actor,
  tripId: string,
  suitcaseId: string | null = null,
): Promise<{ added: number }> {
  await requireTrip(actor, tripId);
  const target = webBag(actor, nullableIdSchema.parse(suitcaseId)) ?? null;
  await requireSuitcase(tripId, target);

  const [equipment, existingItems] = await Promise.all([
    prisma.diveEquipment.findMany({ where: { userId: actor.userId, status: "OWNED" }, select: { name: true } }),
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

  revalidatePacking(tripId);
  return { added: toAdd.length };
}

// ─── Bulk actions ─────────────────────────────────────────────────────────────
// Every where carries tripId: an id from another trip mixed into the list is
// left untouched.

// Only the items that actually change bag are touched (and unpacked). In SQL
// `suitcaseId <> x` is never true for NULL, hence the explicit OR.
export async function movePackingItems(actor: Actor, tripId: string, ids: string[], suitcaseId: string | null) {
  await requireTrip(actor, tripId);
  const itemIds = idListSchema.parse(ids);
  const target = nullableIdSchema.parse(suitcaseId);
  await requireSuitcase(tripId, target);
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
  revalidatePacking(tripId);
}

export async function deletePackingItems(actor: Actor, tripId: string, ids: string[]) {
  await requireTrip(actor, tripId);
  const itemIds = idListSchema.parse(ids);
  await prisma.packingItem.deleteMany({ where: { id: { in: itemIds }, tripId } });
  revalidatePacking(tripId);
}

export async function setPackedPackingItems(actor: Actor, tripId: string, ids: string[], packed: boolean) {
  await requireTrip(actor, tripId);
  const itemIds = idListSchema.parse(ids);
  const value = z.boolean().parse(packed);
  await prisma.packingItem.updateMany({ where: { id: { in: itemIds }, tripId }, data: { packed: value } });
  revalidatePacking(tripId);
}

// undefined: the whole trip; null: the items with no bag; an id: that bag.
export async function unpackAllPackingItems(actor: Actor, tripId: string, suitcaseId?: string | null) {
  await requireTrip(actor, tripId);
  const target = nullableIdSchema.optional().parse(suitcaseId);
  if (target) await requireSuitcase(tripId, target);
  await prisma.packingItem.updateMany({ where: { tripId, suitcaseId: target, packed: true }, data: { packed: false } });
  revalidatePacking(tripId);
}
