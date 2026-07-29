"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { diveAreaSchema, diveSiteSchema } from "@/lib/schemas";
import { requireUser } from "@/lib/action-auth";
import { geocodeDiveSite } from "@/lib/geocode-items";

// El diveAreaId llega desde un <Select> controlado en el cliente — puede ser
// el id de un área ajena si alguien manipula el valor.
async function resolveDiveAreaId(userId: string, diveAreaId: string | undefined): Promise<string | null> {
  if (!diveAreaId) return null;
  const area = await prisma.diveArea.findUnique({ where: { id: diveAreaId }, select: { userId: true } });
  return area && area.userId === userId ? diveAreaId : null;
}

export async function createDiveArea(formData: FormData) {
  const userId = await requireUser();
  const data = diveAreaSchema.parse(Object.fromEntries(formData));

  const area = await prisma.diveArea.create({
    data: {
      userId,
      name: data.name,
      country: data.country || null,
      notes: data.notes || null,
    },
  });

  revalidatePath("/dives/sites");
  return area;
}

export async function updateDiveArea(id: string, formData: FormData) {
  const userId = await requireUser();
  const data = diveAreaSchema.parse(Object.fromEntries(formData));

  await prisma.diveArea.update({
    where: { id, userId },
    data: {
      name: data.name,
      country: data.country || null,
      notes: data.notes || null,
    },
  });

  revalidatePath("/dives/sites");
}

export async function deleteDiveArea(id: string) {
  const userId = await requireUser();
  await prisma.diveArea.delete({ where: { id, userId } });
  revalidatePath("/dives/sites");
}

export async function updateDiveSite(id: string, formData: FormData) {
  const userId = await requireUser();
  const data = diveSiteSchema.parse(Object.fromEntries(formData));
  const diveAreaId = await resolveDiveAreaId(userId, data.diveAreaId);

  const previous = await prisma.diveSite.findUnique({ where: { id, userId }, select: { address: true } });

  await prisma.diveSite.update({
    where: { id, userId },
    data: {
      name: data.name,
      diveAreaId,
      address: data.address || null,
      country: data.country || null,
      region: data.region || null,
      notes: data.notes || null,
      // Si cambia la dirección, las coordenadas guardadas quedan obsoletas —
      // se limpian y se reintenta el geocoding.
      ...(previous && previous.address !== (data.address || null) ? { latitude: null, longitude: null } : {}),
    },
  });

  if (previous && previous.address !== (data.address || null)) void geocodeDiveSite(id);

  revalidatePath("/dives");
  revalidatePath("/dives/sites");
  revalidatePath(`/dives/sites/${id}`);
}

export async function deleteDiveSite(id: string) {
  const userId = await requireUser();
  await prisma.diveSite.delete({ where: { id, userId } });
  revalidatePath("/dives");
  revalidatePath("/dives/sites");
}
