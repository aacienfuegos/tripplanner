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
import { auditedCreate, auditedDelete, auditedUpdate } from "@/lib/services/audit";

export async function createDiveSite(actor: Actor, input: DiveSiteInput) {
  const { diveAreaId, ...data } = parseInput(diveSiteInputSchema, input);
  const resolvedAreaId = await resolveDiveAreaId(actor, diveAreaId);
  const site = await auditedCreate(actor, { entity: "Dive site" }, (db, mark) =>
    db.diveSite.create({ data: { ...data, ...mark, userId: actor.userId, diveAreaId: resolvedAreaId } }),
  );
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

  await auditedUpdate(
    actor,
    { entity: "Dive site", id },
    (db) => db.diveSite.findUnique({ where: { id, userId: actor.userId } }),
    (db, mark) =>
      orNotFound(
        "Dive site",
        db.diveSite.update({
          where: { id, userId: actor.userId },
          data: {
            ...data,
            ...mark,
            diveAreaId: resolvedAreaId,
            ...(addressChanged ? { latitude: null, longitude: null } : {}),
          },
        }),
      ),
  );

  if (addressChanged) void geocodeDiveSite(id);

  revalidatePath("/dives");
  revalidatePath(`/dives/sites/${id}`);
}

// An agent can't delete a site with dives or an area with sites.
export async function deleteDiveSite(actor: Actor, id: string) {
  await auditedDelete(
    actor,
    { entity: "Dive site", id },
    (db) => orNotFound("Dive site", db.diveSite.delete({ where: { id, userId: actor.userId } })),
    async (db) => ({ dives: await db.diveLog.count({ where: { diveSiteId: id, userId: actor.userId } }) }),
  );
  revalidatePath("/dives");
}

export async function createDiveArea(actor: Actor, input: DiveAreaInput) {
  const data = parseInput(diveAreaInputSchema, input);
  const area = await auditedCreate(actor, { entity: "Dive area" }, (db, mark) =>
    db.diveArea.create({ data: { ...data, ...mark, userId: actor.userId } }),
  );
  revalidatePath("/dives");
  return area;
}

export async function updateDiveArea(actor: Actor, id: string, input: Partial<DiveAreaInput>) {
  const data = parseInput(diveAreaInputSchema.partial(), input);
  await auditedUpdate(
    actor,
    { entity: "Dive area", id },
    (db) => db.diveArea.findUnique({ where: { id, userId: actor.userId } }),
    (db, mark) =>
      orNotFound("Dive area", db.diveArea.update({ where: { id, userId: actor.userId }, data: { ...data, ...mark } })),
  );
  revalidatePath("/dives");
}

export async function deleteDiveArea(actor: Actor, id: string) {
  await auditedDelete(
    actor,
    { entity: "Dive area", id },
    (db) => orNotFound("Dive area", db.diveArea.delete({ where: { id, userId: actor.userId } })),
    async (db) => ({ sites: await db.diveSite.count({ where: { diveAreaId: id, userId: actor.userId } }) }),
  );
  revalidatePath("/dives");
}
