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
import { auditedCreate, auditedDelete, auditedUpdate, markOf } from "@/lib/services/audit";

export async function createActivity(actor: Actor, tripId: string, input: ActivityInput) {
  await requireTrip(actor, tripId);
  const data = parseInput(activityInputSchema, input);
  const created = await auditedCreate(actor, { entity: "Activity", tripId }, (db, mark) =>
    db.activity.create({ data: { ...data, ...mark, tripId, scheduledAt: toDate(data.scheduledAt) } }),
  );
  void geocodeActivity(created.id);
  revalidatePath(`/trips/${tripId}/activities`);
  return created;
}

// The stored coordinates may no longer match: they are cleared and geocoded again.
export async function updateActivity(actor: Actor, tripId: string, id: string, input: Partial<ActivityInput>) {
  await requireTrip(actor, tripId);
  const data = parseInput(activityInputSchema.partial(), input);
  await auditedUpdate(
    actor,
    { entity: "Activity", tripId, id },
    (db) => db.activity.findFirst({ where: { id, tripId } }),
    (db, mark) =>
      orNotFound(
        "Activity",
        db.activity.update({
          where: { id, tripId },
          data: { ...data, ...mark, scheduledAt: toDate(data.scheduledAt), latitude: null, longitude: null },
        }),
      ),
  );
  void geocodeActivity(id);
  revalidatePath(`/trips/${tripId}/activities`);
}

export async function updateActivityStatus(actor: Actor, tripId: string, id: string, status: string) {
  await requireTrip(actor, tripId);
  const parsed = parseInput(bookingStatusSchema, status);
  await orNotFound("Activity", prisma.activity.update({ where: { id, tripId }, data: { status: parsed, ...markOf(actor) } }));
  revalidatePath(`/trips/${tripId}/activities`);
}

export async function deleteActivity(actor: Actor, tripId: string, id: string) {
  await requireTrip(actor, tripId);
  await auditedDelete(actor, { entity: "Activity", tripId, id }, (db) =>
    orNotFound("Activity", db.activity.delete({ where: { id, tripId } })),
  );
  revalidatePath(`/trips/${tripId}/activities`);
}
