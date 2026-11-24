import "server-only";
import { prisma } from "@/lib/prisma";
import * as same from "@/lib/duplicates";
import type {
  AccommodationInput,
  ActivityInput,
  DestinationInput,
  DiveAreaInput,
  DiveCertificationInput,
  DiveEquipmentInput,
  DiveEquipmentServiceInput,
  DiveLogInput,
  DiveSiteInput,
  DocumentInput,
  ExpenseInput,
  FlightInput,
  PackingItemInput,
  TaskInput,
  TripInput,
} from "@/lib/agent-schemas";
import type { Actor } from "@/lib/services/actor";

// The element an agent's create would repeat, with the criteria of
// lib/duplicates.ts. Only the agents' creates look: the web and the AI import
// keep what they did. The trip has been checked before, and the logbook is
// read with the actor's user.

const first = <T>(rows: readonly T[], isSame: (row: T) => boolean): T | null => rows.find(isSame) ?? null;

export const duplicateOf = {
  trip: async (actor: Actor, input: TripInput) =>
    first(await prisma.trip.findMany({ where: { userId: actor.userId } }), (row) => same.isDuplicateTrip(row, input)),
  destination: async (tripId: string, input: DestinationInput) =>
    first(await prisma.destination.findMany({ where: { tripId } }), (row) => same.isDuplicateDestination(row, input)),
  flight: async (tripId: string, input: FlightInput) =>
    first(await prisma.flight.findMany({ where: { tripId } }), (row) => same.isDuplicateFlight(row, input)),
  accommodation: async (tripId: string, input: AccommodationInput) =>
    first(await prisma.accommodation.findMany({ where: { tripId } }), (row) =>
      same.isDuplicateAccommodation(row, input),
    ),
  activity: async (tripId: string, input: ActivityInput) =>
    first(await prisma.activity.findMany({ where: { tripId } }), (row) => same.isDuplicateActivity(row, input)),
  document: async (tripId: string, input: DocumentInput) =>
    first(await prisma.document.findMany({ where: { tripId } }), (row) => same.isDuplicateDocument(row, input)),
  expense: async (tripId: string, input: ExpenseInput) =>
    first(await prisma.expense.findMany({ where: { tripId } }), (row) => same.isDuplicateExpense(row, input)),
  task: async (tripId: string, input: TaskInput) =>
    first(await prisma.task.findMany({ where: { tripId } }), (row) => same.isDuplicateTask(row, input)),
  packingItem: async (tripId: string, input: PackingItemInput) =>
    first(await prisma.packingItem.findMany({ where: { tripId } }), (row) => same.isDuplicatePackingItem(row, input)),
  dive: async (actor: Actor, input: DiveLogInput) =>
    first(await prisma.diveLog.findMany({ where: { userId: actor.userId } }), (row) => same.isDuplicateDive(row, input)),
  diveSite: async (actor: Actor, input: DiveSiteInput) =>
    first(await prisma.diveSite.findMany({ where: { userId: actor.userId } }), (row) =>
      same.isDuplicateDiveSiteOrArea(row, input),
    ),
  diveArea: async (actor: Actor, input: DiveAreaInput) =>
    first(await prisma.diveArea.findMany({ where: { userId: actor.userId } }), (row) =>
      same.isDuplicateDiveSiteOrArea(row, input),
    ),
  equipment: async (actor: Actor, input: DiveEquipmentInput) =>
    first(await prisma.diveEquipment.findMany({ where: { userId: actor.userId } }), (row) =>
      same.isDuplicateEquipment(row, input),
    ),
  equipmentService: async (actor: Actor, input: DiveEquipmentServiceInput) =>
    first(await prisma.diveEquipmentService.findMany({ where: { userId: actor.userId } }), (row) =>
      same.isDuplicateEquipmentService(row, input),
    ),
  certification: async (actor: Actor, input: DiveCertificationInput) =>
    first(await prisma.diveCertification.findMany({ where: { userId: actor.userId } }), (row) =>
      same.isDuplicateCertification(row, input),
    ),
};
