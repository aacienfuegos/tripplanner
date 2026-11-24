import "server-only";
import { revalidatePath } from "next/cache";
import { geocodeAccommodation } from "@/lib/geocode-items";
import { accommodationInputSchema, type AccommodationInput } from "@/lib/agent-schemas";
import type { Actor } from "@/lib/services/actor";
import { requireTrip } from "@/lib/services/access";
import { orNotFound, parseInput } from "@/lib/services/errors";
import { toDate } from "@/lib/services/dates";
import { auditedCreate, auditedDelete, auditedUpdate } from "@/lib/services/audit";

export async function createAccommodation(actor: Actor, tripId: string, input: AccommodationInput) {
  await requireTrip(actor, tripId);
  const data = parseInput(accommodationInputSchema, input);
  const created = await auditedCreate(actor, { entity: "Accommodation", tripId }, (db, mark) =>
    db.accommodation.create({
      data: { ...data, ...mark, tripId, checkIn: toDate(data.checkIn), checkOut: toDate(data.checkOut) },
    }),
  );
  void geocodeAccommodation(created.id);
  revalidatePath(`/trips/${tripId}/accommodations`);
  return created;
}

// The stored coordinates may no longer match: they are cleared and geocoded again.
export async function updateAccommodation(actor: Actor, tripId: string, id: string, input: Partial<AccommodationInput>) {
  await requireTrip(actor, tripId);
  const data = parseInput(accommodationInputSchema.partial(), input);
  await auditedUpdate(
    actor,
    { entity: "Accommodation", tripId, id },
    (db) => db.accommodation.findFirst({ where: { id, tripId } }),
    (db, mark) =>
      orNotFound(
        "Accommodation",
        db.accommodation.update({
          where: { id, tripId },
          data: {
            ...data,
            ...mark,
            checkIn: toDate(data.checkIn),
            checkOut: toDate(data.checkOut),
            latitude: null,
            longitude: null,
          },
        }),
      ),
  );
  void geocodeAccommodation(id);
  revalidatePath(`/trips/${tripId}/accommodations`);
}

export async function deleteAccommodation(actor: Actor, tripId: string, id: string) {
  await requireTrip(actor, tripId);
  await auditedDelete(actor, { entity: "Accommodation", tripId, id }, (db) =>
    orNotFound("Accommodation", db.accommodation.delete({ where: { id, tripId } })),
  );
  revalidatePath(`/trips/${tripId}/accommodations`);
}
