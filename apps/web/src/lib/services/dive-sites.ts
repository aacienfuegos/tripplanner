import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { geocodeDiveSite } from "@/lib/geocode-items";
import {
  diveAreaInputSchema,
  diveSiteInputSchema,
  type DiveAreaInput,
  type DiveSiteInput,
} from "@/lib/agent-schemas";
import type { Actor } from "@/lib/services/actor";
import { resolveDiveAreaId } from "@/lib/services/access";
import { NotFoundError, orNotFound, parseInput } from "@/lib/services/errors";

export async function createDiveSite(actor: Actor, input: DiveSiteInput) {
  const { diveAreaId, ...data } = parseInput(diveSiteInputSchema, input);
  const site = await prisma.diveSite.create({
    data: { ...data, userId: actor.userId, diveAreaId: await resolveDiveAreaId(actor, diveAreaId) },
  });
  void geocodeDiveSite(site.id);
  revalidatePath("/dives");
  return site;
}

export async function updateDiveSite(actor: Actor, id: string, input: Partial<DiveSiteInput>) {
  const { diveAreaId, ...data } = parseInput(diveSiteInputSchema.partial(), input);
  const resolvedAreaId = diveAreaId === undefined ? undefined : await resolveDiveAreaId(actor, diveAreaId);

  const previous = await prisma.diveSite.findUnique({ where: { id, userId: actor.userId }, select: { address: true } });
  if (!previous) throw new NotFoundError("Dive site");
  // Si cambia la dirección, las coordenadas guardadas quedan obsoletas —
  // se limpian y se reintenta el geocoding.
  const addressChanged = data.address !== undefined && previous.address !== data.address;

  await orNotFound(
    "Dive site",
    prisma.diveSite.update({
      where: { id, userId: actor.userId },
      data: { ...data, diveAreaId: resolvedAreaId, ...(addressChanged ? { latitude: null, longitude: null } : {}) },
    }),
  );

  if (addressChanged) void geocodeDiveSite(id);

  revalidatePath("/dives");
  revalidatePath(`/dives/sites/${id}`);
}

export async function deleteDiveSite(actor: Actor, id: string) {
  await orNotFound("Dive site", prisma.diveSite.delete({ where: { id, userId: actor.userId } }));
  revalidatePath("/dives");
}

export async function createDiveArea(actor: Actor, input: DiveAreaInput) {
  const data = parseInput(diveAreaInputSchema, input);
  const area = await prisma.diveArea.create({ data: { ...data, userId: actor.userId } });
  revalidatePath("/dives");
  return area;
}

export async function updateDiveArea(actor: Actor, id: string, input: Partial<DiveAreaInput>) {
  const data = parseInput(diveAreaInputSchema.partial(), input);
  await orNotFound("Dive area", prisma.diveArea.update({ where: { id, userId: actor.userId }, data }));
  revalidatePath("/dives");
}

export async function deleteDiveArea(actor: Actor, id: string) {
  await orNotFound("Dive area", prisma.diveArea.delete({ where: { id, userId: actor.userId } }));
  revalidatePath("/dives");
}
