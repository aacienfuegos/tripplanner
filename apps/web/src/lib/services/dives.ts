import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { renumberDives } from "@/lib/dive-numbering";
import { diveLogInputSchema, type DiveLogInput } from "@/lib/agent-schemas";
import type { Actor } from "@/lib/services/actor";
import {
  canReachTrip,
  requireTrip,
  resolveDiveSiteId,
  resolveDiveTripId,
  resolveEquipmentIds,
} from "@/lib/services/access";
import { NotFoundError, orNotFound, parseInput } from "@/lib/services/errors";

const pad = (n: number) => String(n).padStart(2, "0");
const localDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

// The form has a date and an optional time; the database keeps one instant.
const diveDate = (date: string, time: string | null | undefined) => new Date(`${date}T${time || "00:00"}:00`);

function diveFields<T extends Partial<DiveLogInput>>({ tripId: _t, diveSiteId: _s, equipmentIds: _e, date: _d, time: _h, ...fields }: T) {
  return fields;
}

async function findDive(actor: Actor, diveId: string) {
  const dive = await prisma.diveLog.findUnique({
    where: { id: diveId, userId: actor.userId },
    select: { tripId: true, date: true },
  });
  if (!dive) throw new NotFoundError("Dive");
  return dive;
}

// The trip a dive is linked to is part of what an agent's connection guards:
// it can't move or unlink a dive from a trip outside it. The other fields of
// that dive it can edit: the trip list doesn't limit diving.
async function requireAgentCanMoveDive(actor: Actor, diveId: string) {
  const dive = await findDive(actor, diveId);
  if (dive.tripId && !canReachTrip(actor, dive.tripId)) throw new NotFoundError("Trip");
  return dive;
}

export async function createDiveLog(actor: Actor, input: DiveLogInput) {
  const data = parseInput(diveLogInputSchema, input);
  const diveSiteId = await resolveDiveSiteId(actor, data.diveSiteId);
  const tripId = await resolveDiveTripId(actor, data.tripId);
  const equipmentIds = await resolveEquipmentIds(actor, data.equipmentIds ?? []);

  // diveNumber es un valor temporal — renumberDives lo recalcula por fecha
  // justo después de insertar la fila.
  const created = await prisma.diveLog.create({
    data: {
      userId: actor.userId,
      tripId,
      diveNumber: 0,
      diveSiteId,
      ...diveFields(data),
      gasMix: data.gasMix ?? "AIR",
      date: diveDate(data.date, data.time),
      equipment: { connect: equipmentIds.map((id) => ({ id })) },
    },
  });
  await renumberDives(actor.userId);

  revalidatePath("/dives");
  if (tripId) revalidatePath(`/trips/${tripId}/dives`);
  return created;
}

// The web edits every field but the trip (that is link and unlink). An agent's
// edit is partial, and may carry a trip: the current one and the new one have
// to be in its connection.
export async function updateDiveLog(actor: Actor, id: string, input: Partial<DiveLogInput>) {
  const data = parseInput(diveLogInputSchema.partial(), input);
  let stored: Awaited<ReturnType<typeof findDive>> | null = null;
  let tripId: string | null | undefined;
  if (actor.kind === "agent" && data.tripId !== undefined) {
    stored = await requireAgentCanMoveDive(actor, id);
    tripId = await resolveDiveTripId(actor, data.tripId);
  } else if (actor.kind === "agent") {
    stored = await findDive(actor, id);
  }
  const diveSiteId = data.diveSiteId === undefined ? undefined : await resolveDiveSiteId(actor, data.diveSiteId);
  const equipmentIds = data.equipmentIds === undefined ? undefined : await resolveEquipmentIds(actor, data.equipmentIds);

  let date: Date | undefined;
  if (data.date !== undefined || data.time !== undefined) {
    const day = data.date ?? (stored ? localDay(stored.date) : undefined);
    if (day === undefined) throw new NotFoundError("Dive");
    date = diveDate(day, data.time !== undefined ? data.time : stored ? localTime(stored.date) : null);
  }

  await orNotFound(
    "Dive",
    prisma.diveLog.update({
      where: { id, userId: actor.userId },
      data: {
        ...diveFields(data),
        tripId,
        diveSiteId,
        date,
        equipment: equipmentIds === undefined ? undefined : { set: equipmentIds.map((eid) => ({ id: eid })) },
      },
    }),
  );
  // La edición puede haber cambiado la fecha, así que reordena por si afecta
  // a la posición cronológica de esta u otras inmersiones.
  await renumberDives(actor.userId);

  revalidatePath("/dives");
  if (stored?.tripId) revalidatePath(`/trips/${stored.tripId}/dives`);
  if (tripId) revalidatePath(`/trips/${tripId}/dives`);
}

export async function deleteDiveLog(actor: Actor, id: string) {
  await orNotFound("Dive", prisma.diveLog.delete({ where: { id, userId: actor.userId } }));
  await renumberDives(actor.userId);
  revalidatePath("/dives");
}

export async function linkDiveToTrip(actor: Actor, diveId: string, tripId: string) {
  await requireTrip(actor, tripId);
  if (actor.kind === "agent") await requireAgentCanMoveDive(actor, diveId);

  await orNotFound("Dive", prisma.diveLog.update({ where: { id: diveId, userId: actor.userId }, data: { tripId } }));

  revalidatePath("/dives");
  revalidatePath(`/trips/${tripId}/dives`);
}

export async function unlinkDiveFromTrip(actor: Actor, diveId: string) {
  const dive =
    actor.kind === "agent"
      ? await requireAgentCanMoveDive(actor, diveId)
      : await prisma.diveLog.findUnique({ where: { id: diveId, userId: actor.userId }, select: { tripId: true } });

  await orNotFound("Dive", prisma.diveLog.update({ where: { id: diveId, userId: actor.userId }, data: { tripId: null } }));

  revalidatePath("/dives");
  if (dive?.tripId) revalidatePath(`/trips/${dive.tripId}/dives`);
}
