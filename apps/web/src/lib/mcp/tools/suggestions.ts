import "server-only";
import { z } from "zod";
import type { AgentSuggestion } from "@prisma/client";
import { accommodationInputSchema, activityInputSchema } from "@/lib/agent-schemas";
import { PENDING_LIMIT, listSuggestions, suggestAccommodation, suggestActivity } from "@/lib/services/suggestions";
import { CREATE, PAGE, READ, defineTool, idInput, listOutput, page, pageInput, recordOutput } from "@/lib/mcp/tool";

const WAITS =
  `It isn't added to the trip: it waits in the trip's agent suggestions, off the map, the timeline and the expenses, until the user accepts it (it then becomes a normal one) or dismisses it. list_suggestions gives its status. At most ${PENDING_LIMIT} pending per connection in a trip: past that, the error limit and nothing is suggested until the user resolves some.`;

const suggestionOutput = (s: AgentSuggestion) => ({
  id: s.id,
  tripId: s.tripId,
  kind: s.kind,
  status: s.status,
  payload: s.payload,
  createdAt: s.createdAt.toISOString(),
  resolvedAt: s.resolvedAt?.toISOString() ?? null,
  resultId: s.resultId,
});

export const suggestionTools = [
  defineTool({
    name: "suggest_accommodation",
    scope: "trips:suggest",
    title: "Suggest an accommodation",
    description: `Proposes an accommodation for a trip, with the same fields as create_accommodation. ${WAITS}`,
    input: accommodationInputSchema.extend({ tripId: idInput }),
    output: z.object({ suggestion: recordOutput }),
    annotations: CREATE,
    run: async ({ actor }, { tripId, ...input }) => ({
      suggestion: suggestionOutput(await suggestAccommodation(actor, tripId, input)),
    }),
  }),
  defineTool({
    name: "suggest_activity",
    scope: "trips:suggest",
    title: "Suggest an activity",
    description: `Proposes an activity, a restaurant, a visit or a tour for a trip, with the same fields as create_activity. ${WAITS}`,
    input: activityInputSchema.extend({ tripId: idInput }),
    output: z.object({ suggestion: recordOutput }),
    annotations: CREATE,
    run: async ({ actor }, { tripId, ...input }) => ({
      suggestion: suggestionOutput(await suggestActivity(actor, tripId, input)),
    }),
  }),
  defineTool({
    name: "list_suggestions",
    scope: "trips:suggest",
    title: "List suggestions",
    description:
      "The suggestions this connection made, in the trips it can reach, with their status: PENDING, ACCEPTED (resultId is the element created) or DISMISSED. Optionally of one trip. Paginated: pass nextCursor back as cursor.",
    input: z.object({ tripId: idInput.optional(), ...pageInput }),
    output: listOutput,
    annotations: READ,
    run: async ({ actor }, { tripId, cursor, limit = PAGE.default }) =>
      page((await listSuggestions(actor, { tripId, cursor, limit })).map(suggestionOutput), limit),
  }),
];
