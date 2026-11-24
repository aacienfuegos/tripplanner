import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { geocodeAccommodation } from "@/lib/geocode-items";
import { accommodationInputSchema, type AccommodationInput } from "@/lib/agent-schemas";
import type { Actor } from "@/lib/services/actor";
import { requireTrip } from "@/lib/services/access";
import { orNotFound, parseInput } from "@/lib/services/errors";
import { toDate } from "@/lib/services/dates";

export async function createAccommodation(actor: Actor, tripId: string, input: AccommodationInput) {
  await requireTrip(actor, tripId);
  const data = parseInput(accommodationInputSchema, input);
  const created = await prisma.accommodation.create({
    data: { ...data, tripId, checkIn: toDate(data.checkIn), checkOut: toDate(data.checkOut) },
  });
  void geocodeAccommodation(created.id);
  revalidatePath(`/trips/${tripId}/accommodations`);
  return created;
}

// The stored coordinates may no longer match: they are cleared and geocoded again.
export async function updateAccommodation(actor: Actor, tripId: string, id: string, input: Partial<AccommodationInput>) {
  await requireTrip(actor, tripId);
  const data = parseInput(accommodationInputSchema.partial(), input);
  await orNotFound(
    "Accommodation",
    prisma.accommodation.update({
      where: { id, tripId },
      data: { ...data, checkIn: toDate(data.checkIn), checkOut: toDate(data.checkOut), latitude: null, longitude: null },
    }),
  );
  void geocodeAccommodation(id);
  revalidatePath(`/trips/${tripId}/accommodations`);
}

export async function deleteAccommodation(actor: Actor, tripId: string, id: string) {
  await requireTrip(actor, tripId);
  await orNotFound("Accommodation", prisma.accommodation.delete({ where: { id, tripId } }));
  revalidatePath(`/trips/${tripId}/accommodations`);
}
