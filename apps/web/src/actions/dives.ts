"use server";

import { diveLogSchema, diveSiteSchema } from "@/lib/schemas";
import { mapDiveLogInput } from "@/lib/dive-log-mapper";
import type { DiveLogInput } from "@/lib/agent-schemas";
import { redirectIfTripNotFound, webActor } from "@/lib/services/actor";
import * as dives from "@/lib/services/dives";
import * as diveSites from "@/lib/services/dive-sites";

// The ids of site, trip and equipment come from controls of the client and may
// be another user's: the service drops those, as these actions always did.
function toInput(formData: FormData): DiveLogInput {
  const data = diveLogSchema.parse(Object.fromEntries(formData));
  const { diveSiteId: _s, date: _d, ...fields } = mapDiveLogInput(data, null);
  return {
    ...fields,
    date: data.date,
    time: data.time || null,
    tripId: data.tripId || null,
    diveSiteId: data.diveSiteId || null,
    equipmentIds: formData.getAll("equipmentIds").map(String).filter(Boolean),
  };
}

export async function createDiveSite(formData: FormData) {
  const actor = await webActor();
  const data = diveSiteSchema.parse(Object.fromEntries(formData));
  return diveSites.createDiveSite(actor, {
    name: data.name,
    address: data.address || null,
    country: data.country || null,
    region: data.region || null,
    notes: data.notes || null,
  });
}

export async function createDiveLog(formData: FormData) {
  const actor = await webActor();
  await dives.createDiveLog(actor, toInput(formData));
}

// The trip is changed with linkDiveToTrip and unlinkDiveFromTrip, not here.
export async function updateDiveLog(id: string, formData: FormData) {
  const actor = await webActor();
  const { tripId: _t, ...input } = toInput(formData);
  await dives.updateDiveLog(actor, id, input);
}

export async function deleteDiveLog(id: string) {
  const actor = await webActor();
  await dives.deleteDiveLog(actor, id);
}

export async function linkDiveToTrip(diveId: string, tripId: string) {
  const actor = await webActor();
  await redirectIfTripNotFound(dives.linkDiveToTrip(actor, diveId, tripId));
}

export async function unlinkDiveFromTrip(diveId: string) {
  const actor = await webActor();
  await dives.unlinkDiveFromTrip(actor, diveId);
}
