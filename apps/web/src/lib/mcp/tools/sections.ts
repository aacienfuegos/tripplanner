import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  accommodationInputSchema,
  activityInputSchema,
  destinationInputSchema,
  documentInputSchema,
  expenseInputSchema,
  flightInputSchema,
  packingItemInputSchema,
  taskInputSchema,
} from "@/lib/agent-schemas";
import type { AgentActor } from "@/lib/oauth/verify";
import { requireTrip } from "@/lib/services/access";
import { duplicateOf } from "@/lib/services/agent-duplicates";
import { DuplicateError, NotFoundError, type Entity } from "@/lib/services/errors";
import { createAccommodation, updateAccommodation } from "@/lib/services/accommodations";
import { createActivity, updateActivity } from "@/lib/services/activities";
import { createDestination, updateDestination } from "@/lib/services/destinations";
import { createDocument, updateDocument } from "@/lib/services/documents";
import { createExpense, updateExpense } from "@/lib/services/expenses";
import { createFlight, updateFlight } from "@/lib/services/flights";
import { createPackingItem, updatePackingItem } from "@/lib/services/packing";
import { createTask, updateTask } from "@/lib/services/tasks";
import { CREATE, DUPLICATES, EDIT, defineTool, idInput, recordOutput, toOutput } from "@/lib/mcp/tool";

// create_ and update_ of the eight sections of a trip. The trip goes through
// requireTrip before anything else, and the element is always looked for with
// `{ id, tripId }` of that trip.

const createKeys = { tripId: idInput, force: z.boolean().optional() };
const updateKeys = { tripId: idInput, id: idInput };
const PARTIAL = "Changes the fields given and leaves the rest; null clears an optional field.";
const DAYS = "Dates are YYYY-MM-DD and times YYYY-MM-DDTHH:mm, in local time.";

async function rejectDuplicate(actor: AgentActor, tripId: string, find: () => Promise<Record<string, unknown> | null>) {
  await requireTrip(actor, tripId);
  const existing = await find();
  if (existing) throw new DuplicateError(toOutput(existing));
}

async function found(entity: Entity, row: Promise<Record<string, unknown> | null>) {
  const value = await row;
  if (!value) throw new NotFoundError(entity);
  return toOutput(value);
}

export const sectionTools = [
  defineTool({
    name: "create_destination",
    scope: "trips:write",
    title: "Add a destination",
    description: `Adds a city to a trip; the list is kept in order of arrival. country is an ISO 3166-1 alpha-2 code. ${DAYS} Same destination: same country, same city and same arrival day. ${DUPLICATES}`,
    input: destinationInputSchema.extend(createKeys),
    output: z.object({ destination: recordOutput }),
    annotations: CREATE,
    run: async ({ actor }, { tripId, force, ...input }) => {
      if (!force) await rejectDuplicate(actor, tripId, () => duplicateOf.destination(tripId, input));
      return { destination: toOutput(await createDestination(actor, tripId, input)) };
    },
  }),
  defineTool({
    name: "update_destination",
    scope: "trips:write",
    title: "Update a destination",
    description: `${PARTIAL} ${DAYS}`,
    input: destinationInputSchema.partial().extend(updateKeys),
    output: z.object({ destination: recordOutput }),
    annotations: EDIT,
    run: async ({ actor }, { tripId, id, ...input }) => {
      await updateDestination(actor, tripId, id, input);
      return { destination: await found("Destination", prisma.destination.findFirst({ where: { id, tripId } })) };
    },
  }),
  defineTool({
    name: "create_flight",
    scope: "trips:write",
    title: "Add a flight",
    description: `Adds a flight to a trip. ${DAYS} Same flight: same flight number and same departure day. ${DUPLICATES}`,
    input: flightInputSchema.extend(createKeys),
    output: z.object({ flight: recordOutput }),
    annotations: CREATE,
    run: async ({ actor }, { tripId, force, ...input }) => {
      if (!force) await rejectDuplicate(actor, tripId, () => duplicateOf.flight(tripId, input));
      return { flight: toOutput(await createFlight(actor, tripId, input)) };
    },
  }),
  defineTool({
    name: "update_flight",
    scope: "trips:write",
    title: "Update a flight",
    description: `${PARTIAL} ${DAYS}`,
    input: flightInputSchema.partial().extend(updateKeys),
    output: z.object({ flight: recordOutput }),
    annotations: EDIT,
    run: async ({ actor }, { tripId, id, ...input }) => {
      await updateFlight(actor, tripId, id, input);
      return { flight: await found("Flight", prisma.flight.findFirst({ where: { id, tripId } })) };
    },
  }),
  defineTool({
    name: "create_accommodation",
    scope: "trips:write",
    title: "Add an accommodation",
    description: `Adds an accommodation to a trip; its address is put on the map afterwards. ${DAYS} Same accommodation: similar name and same check-in day. ${DUPLICATES}`,
    input: accommodationInputSchema.extend(createKeys),
    output: z.object({ accommodation: recordOutput }),
    annotations: CREATE,
    run: async ({ actor }, { tripId, force, ...input }) => {
      if (!force) await rejectDuplicate(actor, tripId, () => duplicateOf.accommodation(tripId, input));
      return { accommodation: toOutput(await createAccommodation(actor, tripId, input)) };
    },
  }),
  defineTool({
    name: "update_accommodation",
    scope: "trips:write",
    title: "Update an accommodation",
    description: `${PARTIAL} ${DAYS} The address is put on the map again.`,
    input: accommodationInputSchema.partial().extend(updateKeys),
    output: z.object({ accommodation: recordOutput }),
    annotations: EDIT,
    run: async ({ actor }, { tripId, id, ...input }) => {
      await updateAccommodation(actor, tripId, id, input);
      return { accommodation: await found("Accommodation", prisma.accommodation.findFirst({ where: { id, tripId } })) };
    },
  }),
  defineTool({
    name: "create_activity",
    scope: "trips:write",
    title: "Add an activity",
    description: `Adds an activity, a restaurant, a visit or a tour to a trip. ${DAYS} Same activity: similar name and same day. ${DUPLICATES}`,
    input: activityInputSchema.extend(createKeys),
    output: z.object({ activity: recordOutput }),
    annotations: CREATE,
    run: async ({ actor }, { tripId, force, ...input }) => {
      if (!force) await rejectDuplicate(actor, tripId, () => duplicateOf.activity(tripId, input));
      return { activity: toOutput(await createActivity(actor, tripId, input)) };
    },
  }),
  defineTool({
    name: "update_activity",
    scope: "trips:write",
    title: "Update an activity",
    description: `${PARTIAL} ${DAYS}`,
    input: activityInputSchema.partial().extend(updateKeys),
    output: z.object({ activity: recordOutput }),
    annotations: EDIT,
    run: async ({ actor }, { tripId, id, ...input }) => {
      await updateActivity(actor, tripId, id, input);
      return { activity: await found("Activity", prisma.activity.findFirst({ where: { id, tripId } })) };
    },
  }),
  defineTool({
    name: "create_document",
    scope: "trips:write",
    title: "Add a document",
    description: `Adds a document of a trip (passport, visa, insurance, ticket, voucher). fileUrl is a link, http or https only. ${DAYS} Same document: similar name and same type. ${DUPLICATES}`,
    input: documentInputSchema.extend(createKeys),
    output: z.object({ document: recordOutput }),
    annotations: CREATE,
    run: async ({ actor }, { tripId, force, ...input }) => {
      if (!force) await rejectDuplicate(actor, tripId, () => duplicateOf.document(tripId, input));
      return { document: toOutput(await createDocument(actor, tripId, input)) };
    },
  }),
  defineTool({
    name: "update_document",
    scope: "trips:write",
    title: "Update a document",
    description: `${PARTIAL} ${DAYS}`,
    input: documentInputSchema.partial().extend(updateKeys),
    output: z.object({ document: recordOutput }),
    annotations: EDIT,
    run: async ({ actor }, { tripId, id, ...input }) => {
      await updateDocument(actor, tripId, id, input);
      return { document: await found("Document", prisma.document.findFirst({ where: { id, tripId } })) };
    },
  }),
  defineTool({
    name: "create_expense",
    scope: "trips:write",
    title: "Add an expense",
    description: `Adds an expense to a trip. currency is an ISO 4217 code; when it isn't the trip's, the amount is converted to it. ${DAYS} Same expense: similar description, same amount and same day. ${DUPLICATES}`,
    input: expenseInputSchema.extend(createKeys),
    output: z.object({ expense: recordOutput }),
    annotations: CREATE,
    run: async ({ actor }, { tripId, force, ...input }) => {
      if (!force) await rejectDuplicate(actor, tripId, () => duplicateOf.expense(tripId, input));
      return { expense: toOutput(await createExpense(actor, tripId, input)) };
    },
  }),
  defineTool({
    name: "update_expense",
    scope: "trips:write",
    title: "Update an expense",
    description: `${PARTIAL} ${DAYS} Changing the amount or the currency converts it again.`,
    input: expenseInputSchema.partial().extend(updateKeys),
    output: z.object({ expense: recordOutput }),
    annotations: EDIT,
    run: async ({ actor }, { tripId, id, ...input }) => {
      await updateExpense(actor, tripId, id, input);
      return { expense: await found("Expense", prisma.expense.findFirst({ where: { id, tripId } })) };
    },
  }),
  defineTool({
    name: "create_task",
    scope: "trips:write",
    title: "Add a task",
    description: `Adds a to-do of a trip. ${DAYS} Same task: similar title and same due day, or both without one. ${DUPLICATES}`,
    input: taskInputSchema.extend(createKeys),
    output: z.object({ task: recordOutput }),
    annotations: CREATE,
    run: async ({ actor }, { tripId, force, ...input }) => {
      if (!force) await rejectDuplicate(actor, tripId, () => duplicateOf.task(tripId, input));
      return { task: toOutput(await createTask(actor, tripId, input)) };
    },
  }),
  defineTool({
    name: "update_task",
    scope: "trips:write",
    title: "Update a task",
    description: `${PARTIAL} ${DAYS} Marking it done is left to the user.`,
    input: taskInputSchema.partial().extend(updateKeys),
    output: z.object({ task: recordOutput }),
    annotations: EDIT,
    run: async ({ actor }, { tripId, id, ...input }) => {
      await updateTask(actor, tripId, id, input);
      return { task: await found("Task", prisma.task.findFirst({ where: { id, tripId } })) };
    },
  }),
  defineTool({
    name: "create_packing_item",
    scope: "trips:write",
    title: "Add a packing item",
    description: `Adds an item to the packing list of a trip, in no suitcase: choosing the bag is left to the user. Same item: similar name and same category. ${DUPLICATES}`,
    input: packingItemInputSchema.extend(createKeys),
    output: z.object({ packingItem: recordOutput }),
    annotations: CREATE,
    run: async ({ actor }, { tripId, force, ...input }) => {
      if (!force) await rejectDuplicate(actor, tripId, () => duplicateOf.packingItem(tripId, input));
      return { packingItem: toOutput(await createPackingItem(actor, tripId, input)) };
    },
  }),
  defineTool({
    name: "update_packing_item",
    scope: "trips:write",
    title: "Update a packing item",
    description: `${PARTIAL} Its suitcase stays as it is.`,
    input: packingItemInputSchema.partial().extend(updateKeys),
    output: z.object({ packingItem: recordOutput }),
    annotations: EDIT,
    run: async ({ actor }, { tripId, id, ...input }) => {
      await updatePackingItem(actor, tripId, id, input);
      return { packingItem: await found("Packing item", prisma.packingItem.findFirst({ where: { id, tripId } })) };
    },
  }),
];
