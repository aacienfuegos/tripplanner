import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { tripStatusSchema } from "@/lib/schemas";
import { tripInputSchema, type TripInput } from "@/lib/agent-schemas";
import type { Actor } from "@/lib/services/actor";
import { requireTrip } from "@/lib/services/access";
import { orNotFound, parseInput } from "@/lib/services/errors";
import { toDate } from "@/lib/services/dates";
import { recalculateExpenseConversions } from "@/lib/services/expenses";

export async function createTrip(actor: Actor, input: TripInput) {
  const data = parseInput(tripInputSchema, input);
  const trip = await prisma.trip.create({
    data: { ...data, userId: actor.userId, startDate: toDate(data.startDate), endDate: toDate(data.endDate) },
  });
  revalidatePath("/trips");
  return trip;
}

export async function updateTrip(actor: Actor, tripId: string, input: Partial<TripInput>) {
  const trip = await requireTrip(actor, tripId);
  const data = parseInput(tripInputSchema.partial(), input);

  await orNotFound(
    "Trip",
    prisma.trip.update({
      where: { id: tripId, userId: actor.userId },
      data: { ...data, startDate: toDate(data.startDate), endDate: toDate(data.endDate) },
    }),
  );

  if (data.currency !== undefined && data.currency !== trip.currency) {
    await recalculateExpenseConversions(tripId, data.currency);
    revalidatePath(`/trips/${tripId}/expenses`);
  }

  revalidatePath(`/trips/${tripId}`);
  revalidatePath("/trips");
}

export async function updateTripStatus(actor: Actor, tripId: string, status: string) {
  await requireTrip(actor, tripId);
  const parsed = parseInput(tripStatusSchema, status);
  await orNotFound("Trip", prisma.trip.update({ where: { id: tripId, userId: actor.userId }, data: { status: parsed } }));
  revalidatePath(`/trips/${tripId}`);
  revalidatePath("/trips");
}

export async function deleteTrip(actor: Actor, tripId: string) {
  await requireTrip(actor, tripId);
  await orNotFound("Trip", prisma.trip.delete({ where: { id: tripId, userId: actor.userId } }));
  revalidatePath("/trips");
}
