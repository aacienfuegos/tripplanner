import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { geocodeActivity } from "@/lib/geocode-items";
import { bookingStatusSchema } from "@/lib/schemas";
import { activityInputSchema, type ActivityInput } from "@/lib/agent-schemas";
import type { Actor } from "@/lib/services/actor";
import { requireTrip } from "@/lib/services/access";
import { orNotFound, parseInput } from "@/lib/services/errors";
import { toDate } from "@/lib/services/dates";

export async function createActivity(actor: Actor, tripId: string, input: ActivityInput) {
  await requireTrip(actor, tripId);
  const data = parseInput(activityInputSchema, input);
  const created = await prisma.activity.create({ data: { ...data, tripId, scheduledAt: toDate(data.scheduledAt) } });
  void geocodeActivity(created.id);
  revalidatePath(`/trips/${tripId}/activities`);
  return created;
}

// The stored coordinates may no longer match: they are cleared and geocoded again.
export async function updateActivity(actor: Actor, tripId: string, id: string, input: Partial<ActivityInput>) {
  await requireTrip(actor, tripId);
  const data = parseInput(activityInputSchema.partial(), input);
  await orNotFound(
    "Activity",
    prisma.activity.update({
      where: { id, tripId },
      data: { ...data, scheduledAt: toDate(data.scheduledAt), latitude: null, longitude: null },
    }),
  );
  void geocodeActivity(id);
  revalidatePath(`/trips/${tripId}/activities`);
}

export async function updateActivityStatus(actor: Actor, tripId: string, id: string, status: string) {
  await requireTrip(actor, tripId);
  const parsed = parseInput(bookingStatusSchema, status);
  await orNotFound("Activity", prisma.activity.update({ where: { id, tripId }, data: { status: parsed } }));
  revalidatePath(`/trips/${tripId}/activities`);
}

export async function deleteActivity(actor: Actor, tripId: string, id: string) {
  await requireTrip(actor, tripId);
  await orNotFound("Activity", prisma.activity.delete({ where: { id, tripId } }));
  revalidatePath(`/trips/${tripId}/activities`);
}
