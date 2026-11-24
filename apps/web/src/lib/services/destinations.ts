import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { destinationInputSchema, type DestinationInput } from "@/lib/agent-schemas";
import type { Actor } from "@/lib/services/actor";
import { requireTrip } from "@/lib/services/access";
import { orNotFound, parseInput } from "@/lib/services/errors";
import { toDate } from "@/lib/services/dates";
import { auditedCreate, auditedUpdate } from "@/lib/services/audit";

// El orden de la lista se deriva de arrivalDate en vez de pedirle al usuario
// que reordene a mano — es lo que ya usa cityForDay() en el timeline del viaje.
async function reorderDestinations(tripId: string) {
  const destinations = await prisma.destination.findMany({
    where: { tripId },
    orderBy: { arrivalDate: "asc" },
    select: { id: true },
  });
  await Promise.all(
    destinations.map((d, i) => prisma.destination.update({ where: { id: d.id }, data: { order: i } })),
  );
}

function revalidateDestinationPaths(tripId: string) {
  revalidatePath(`/trips/${tripId}`);
  revalidatePath(`/trips/${tripId}/destinations`);
  revalidatePath("/trips");
  revalidatePath("/dashboard");
}

export async function createDestination(actor: Actor, tripId: string, input: DestinationInput) {
  await requireTrip(actor, tripId);
  const data = parseInput(destinationInputSchema, input);
  const created = await auditedCreate(actor, { entity: "Destination", tripId }, (db, mark) =>
    db.destination.create({
      data: { ...data, ...mark, tripId, arrivalDate: toDate(data.arrivalDate), departureDate: toDate(data.departureDate) },
    }),
  );
  await reorderDestinations(tripId);
  revalidateDestinationPaths(tripId);
  return created;
}

export async function updateDestination(actor: Actor, tripId: string, id: string, input: Partial<DestinationInput>) {
  await requireTrip(actor, tripId);
  const data = parseInput(destinationInputSchema.partial(), input);
  await auditedUpdate(
    actor,
    { entity: "Destination", tripId, id },
    (db) => db.destination.findFirst({ where: { id, tripId } }),
    (db, mark) =>
      orNotFound(
        "Destination",
        db.destination.update({
          where: { id, tripId },
          data: { ...data, ...mark, arrivalDate: toDate(data.arrivalDate), departureDate: toDate(data.departureDate) },
        }),
      ),
  );
  await reorderDestinations(tripId);
  revalidateDestinationPaths(tripId);
}

export async function deleteDestination(actor: Actor, tripId: string, id: string) {
  await requireTrip(actor, tripId);
  await orNotFound("Destination", prisma.destination.delete({ where: { id, tripId } }));
  revalidateDestinationPaths(tripId);
}
