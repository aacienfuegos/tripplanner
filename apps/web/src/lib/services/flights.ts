import "server-only";
import { revalidatePath } from "next/cache";
import { flightInputSchema, type FlightInput } from "@/lib/agent-schemas";
import type { Actor } from "@/lib/services/actor";
import { requireTrip } from "@/lib/services/access";
import { orNotFound, parseInput } from "@/lib/services/errors";
import { toDate } from "@/lib/services/dates";
import { auditedCreate, auditedDelete, auditedUpdate } from "@/lib/services/audit";

// Flights aren't geocoded here: the map fills in the missing coordinates.

export async function createFlight(actor: Actor, tripId: string, input: FlightInput) {
  await requireTrip(actor, tripId);
  const data = parseInput(flightInputSchema, input);
  const created = await auditedCreate(actor, { entity: "Flight", tripId }, (db, mark) =>
    db.flight.create({
      data: { ...data, ...mark, tripId, departureAt: toDate(data.departureAt), arrivalAt: toDate(data.arrivalAt) },
    }),
  );
  revalidatePath(`/trips/${tripId}/flights`);
  return created;
}

export async function updateFlight(actor: Actor, tripId: string, id: string, input: Partial<FlightInput>) {
  await requireTrip(actor, tripId);
  const data = parseInput(flightInputSchema.partial(), input);
  await auditedUpdate(
    actor,
    { entity: "Flight", tripId, id },
    (db) => db.flight.findFirst({ where: { id, tripId } }),
    (db, mark) =>
      orNotFound(
        "Flight",
        db.flight.update({
          where: { id, tripId },
          data: { ...data, ...mark, departureAt: toDate(data.departureAt), arrivalAt: toDate(data.arrivalAt) },
        }),
      ),
  );
  revalidatePath(`/trips/${tripId}/flights`);
}

export async function deleteFlight(actor: Actor, tripId: string, id: string) {
  await requireTrip(actor, tripId);
  await auditedDelete(actor, { entity: "Flight", tripId, id }, (db) =>
    orNotFound("Flight", db.flight.delete({ where: { id, tripId } })),
  );
  revalidatePath(`/trips/${tripId}/flights`);
}
