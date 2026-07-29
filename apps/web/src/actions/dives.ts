"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { diveLogSchema, diveSiteSchema } from "@/lib/schemas";
import { requireUser, requireTripOwner } from "@/lib/action-auth";
import { geocodeDiveSite } from "@/lib/geocode-items";
import { mapDiveLogInput } from "@/lib/dive-log-mapper";
import { renumberDives } from "@/lib/dive-numbering";

// El diveSiteId llega desde un <Select> controlado en el cliente — puede ser
// el id de un site ajeno si alguien manipula el valor. Se revalida contra
// userId aquí en vez de confiar en lo que generó el formulario.
async function resolveDiveSiteId(userId: string, diveSiteId: string | undefined): Promise<string | null> {
  if (!diveSiteId) return null;
  const site = await prisma.diveSite.findUnique({ where: { id: diveSiteId }, select: { userId: true } });
  return site && site.userId === userId ? diveSiteId : null;
}

// Mismo motivo que resolveDiveSiteId: el tripId llega del formulario de
// creación (hidden input cuando se crea una inmersión ya vinculada a un
// viaje) y hay que revalidar la propiedad antes de persistirlo.
async function resolveTripId(userId: string, tripId: string | undefined): Promise<string | null> {
  if (!tripId) return null;
  const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { userId: true } });
  return trip && trip.userId === userId ? tripId : null;
}

export async function createDiveSite(formData: FormData) {
  const userId = await requireUser();
  const data = diveSiteSchema.parse(Object.fromEntries(formData));

  const site = await prisma.diveSite.create({
    data: {
      userId,
      name: data.name,
      address: data.address || null,
      country: data.country || null,
      region: data.region || null,
      notes: data.notes || null,
    },
  });

  void geocodeDiveSite(site.id);
  revalidatePath("/dives");
  return site;
}

export async function createDiveLog(formData: FormData) {
  const userId = await requireUser();
  const data = diveLogSchema.parse(Object.fromEntries(formData));
  const diveSiteId = await resolveDiveSiteId(userId, data.diveSiteId);
  const tripId = await resolveTripId(userId, data.tripId);

  // diveNumber es un valor temporal — renumberDives lo recalcula por fecha
  // justo después de insertar la fila.
  await prisma.diveLog.create({
    data: {
      userId,
      tripId,
      diveNumber: 0,
      ...mapDiveLogInput(data, diveSiteId),
    },
  });
  await renumberDives(userId);

  revalidatePath("/dives");
  if (tripId) revalidatePath(`/trips/${tripId}/dives`);
}

export async function updateDiveLog(id: string, formData: FormData) {
  const userId = await requireUser();
  const data = diveLogSchema.parse(Object.fromEntries(formData));
  const diveSiteId = await resolveDiveSiteId(userId, data.diveSiteId);

  await prisma.diveLog.update({
    where: { id, userId },
    data: mapDiveLogInput(data, diveSiteId),
  });
  // La edición puede haber cambiado la fecha, así que reordena por si afecta
  // a la posición cronológica de esta u otras inmersiones.
  await renumberDives(userId);

  revalidatePath("/dives");
}

export async function deleteDiveLog(id: string) {
  const userId = await requireUser();
  await prisma.diveLog.delete({ where: { id, userId } });
  await renumberDives(userId);
  revalidatePath("/dives");
}

export async function linkDiveToTrip(diveId: string, tripId: string) {
  const userId = await requireUser();
  await requireTripOwner(tripId);

  await prisma.diveLog.update({
    where: { id: diveId, userId },
    data: { tripId },
  });

  revalidatePath("/dives");
  revalidatePath(`/trips/${tripId}/dives`);
}

export async function unlinkDiveFromTrip(diveId: string) {
  const userId = await requireUser();

  const dive = await prisma.diveLog.findUnique({
    where: { id: diveId, userId },
    select: { tripId: true },
  });

  await prisma.diveLog.update({
    where: { id: diveId, userId },
    data: { tripId: null },
  });

  revalidatePath("/dives");
  if (dive?.tripId) revalidatePath(`/trips/${dive.tripId}/dives`);
}
