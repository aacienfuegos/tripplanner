"use server";

import { diveAreaSchema, diveSiteSchema } from "@/lib/schemas";
import { webActor } from "@/lib/services/actor";
import * as diveSites from "@/lib/services/dive-sites";

export async function createDiveArea(formData: FormData) {
  const actor = await webActor();
  const data = diveAreaSchema.parse(Object.fromEntries(formData));
  return diveSites.createDiveArea(actor, { name: data.name, country: data.country || null, notes: data.notes || null });
}

export async function updateDiveArea(id: string, formData: FormData) {
  const actor = await webActor();
  const data = diveAreaSchema.parse(Object.fromEntries(formData));
  await diveSites.updateDiveArea(actor, id, { name: data.name, country: data.country || null, notes: data.notes || null });
}

export async function deleteDiveArea(id: string) {
  const actor = await webActor();
  await diveSites.deleteDiveArea(actor, id);
}

// El diveAreaId llega desde un <Select> controlado en el cliente — puede ser
// el id de un área ajena si alguien manipula el valor: el servicio lo descarta.
export async function updateDiveSite(id: string, formData: FormData) {
  const actor = await webActor();
  const data = diveSiteSchema.parse(Object.fromEntries(formData));
  await diveSites.updateDiveSite(actor, id, {
    name: data.name,
    diveAreaId: data.diveAreaId || null,
    address: data.address || null,
    country: data.country || null,
    region: data.region || null,
    notes: data.notes || null,
  });
}

export async function deleteDiveSite(id: string) {
  const actor = await webActor();
  await diveSites.deleteDiveSite(actor, id);
}
