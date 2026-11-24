import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { tripInputSchema } from "@/lib/agent-schemas";
import { createTrip, updateTrip } from "@/lib/services/trips";
import { getTrip, listTrips } from "@/lib/services/trip-reads";
import { duplicateOf } from "@/lib/services/agent-duplicates";
import { DuplicateError, NotFoundError } from "@/lib/services/errors";
import {
  CREATE,
  DUPLICATES,
  EDIT,
  PAGE,
  READ,
  defineTool,
  idInput,
  listOutput,
  localTime,
  page,
  pageInput,
  recordOutput,
  requireAllTrips,
  toOutput,
} from "@/lib/mcp/tool";

const sectionList = z.array(recordOutput);

export const tripTools = [
  defineTool({
    name: "list_trips",
    scope: "trips:read",
    title: "List trips",
    description: "Lists the trips this connection can reach, without their sections. Paginated: pass nextCursor back as cursor.",
    input: z.object(pageInput),
    output: listOutput,
    annotations: READ,
    run: async ({ actor }, { cursor, limit = PAGE.default }) => {
      const trips = await listTrips(actor, { cursor, limit });
      return page(trips.map(toOutput), limit);
    },
  }),
  defineTool({
    name: "get_trip",
    scope: "trips:read",
    title: "Get a trip",
    description:
      "A trip with all its sections (destinations, flights, accommodations, activities, documents, expenses, tasks and packing items) and the summary of its dives: date, site, depth and time. At most 500 elements per section; the ones cut short are listed in truncated.",
    input: z.object({ tripId: idInput }),
    output: z.object({
      trip: recordOutput,
      destinations: sectionList,
      flights: sectionList,
      accommodations: sectionList,
      activities: sectionList,
      documents: sectionList,
      expenses: sectionList,
      tasks: sectionList,
      packingItems: sectionList,
      dives: sectionList,
      truncated: z.array(z.string()),
    }),
    annotations: READ,
    run: async ({ actor }, { tripId }) => {
      const { trip, sections, truncated } = await getTrip(actor, tripId);
      return {
        trip: toOutput(trip),
        destinations: sections.destinations.map(toOutput),
        flights: sections.flights.map(toOutput),
        accommodations: sections.accommodations.map(toOutput),
        activities: sections.activities.map(toOutput),
        documents: sections.documents.map(toOutput),
        expenses: sections.expenses.map(toOutput),
        tasks: sections.tasks.map(toOutput),
        packingItems: sections.packingItems.map(toOutput),
        dives: sections.dives.map(({ date, diveSite, ...dive }) => ({
          ...toOutput({ ...dive, date }),
          time: localTime(date),
          site: diveSite?.name ?? null,
        })),
        truncated,
      };
    },
  }),
  defineTool({
    name: "create_trip",
    scope: "trips:write",
    title: "Create a trip",
    description: `Creates a trip. Only with a connection to all trips. Dates are YYYY-MM-DD. Same trip: similar name and same start day. ${DUPLICATES}`,
    input: tripInputSchema.extend({ force: z.boolean().optional() }),
    output: z.object({ trip: recordOutput }),
    annotations: CREATE,
    allTripsOnly: true,
    run: async ({ actor }, { force, ...input }) => {
      requireAllTrips(actor);
      if (!force) {
        const existing = await duplicateOf.trip(actor, input);
        if (existing) throw new DuplicateError(toOutput(existing));
      }
      return { trip: toOutput(await createTrip(actor, input)) };
    },
  }),
  defineTool({
    name: "update_trip",
    scope: "trips:write",
    title: "Update a trip",
    description:
      "Changes the fields given of a trip and leaves the rest. Only with a connection to all trips. Changing the currency converts every expense again.",
    input: tripInputSchema.partial().extend({ tripId: idInput }),
    output: z.object({ trip: recordOutput }),
    annotations: EDIT,
    allTripsOnly: true,
    run: async ({ actor }, { tripId, ...input }) => {
      requireAllTrips(actor);
      await updateTrip(actor, tripId, input);
      const trip = await prisma.trip.findUnique({ where: { id: tripId, userId: actor.userId } });
      if (!trip) throw new NotFoundError("Trip");
      return { trip: toOutput(trip) };
    },
  }),
];
