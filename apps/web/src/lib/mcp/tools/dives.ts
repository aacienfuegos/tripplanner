import "server-only";
import { z } from "zod";
import { diveLogInputSchema } from "@/lib/agent-schemas";
import type { AgentActor } from "@/lib/oauth/verify";
import { canReachTrip } from "@/lib/services/access";
import { duplicateOf } from "@/lib/services/agent-duplicates";
import { DuplicateError } from "@/lib/services/errors";
import { createDiveLog, linkDiveToTrip, unlinkDiveFromTrip, updateDiveLog } from "@/lib/services/dives";
import { setDiveClipLinks } from "@/lib/services/dive-media";
import { getDive, getDiveProfile, getDiveStats, listDiveMedia, listDives } from "@/lib/services/dive-reads";
import {
  CREATE,
  DUPLICATES,
  EDIT,
  PAGE,
  READ,
  defineTool,
  idInput,
  listOutput,
  localDay,
  localTime,
  page,
  pageInput,
  recordOutput,
  toOutput,
} from "@/lib/mcp/tool";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
const TRIP_RULE =
  "A tripId has to be one of the trips of this connection; a dive linked to a trip outside it can't be moved or unlinked.";

type DiveRow = Readonly<Record<string, unknown>> & { readonly id: string; readonly date: Date; readonly tripId: string | null };

// The day and the time apart, as they are written. Of a trip outside the
// connection, only its opaque id.
function diveOutput(actor: AgentActor, dive: DiveRow, tripNames: ReadonlyMap<string, string>) {
  const { date, tripId, ...rest } = dive;
  const reachable = tripId !== null && canReachTrip(actor, tripId);
  return {
    ...toOutput({ ...rest, date }),
    time: localTime(date),
    tripId,
    tripName: reachable ? (tripNames.get(tripId) ?? null) : null,
  };
}

const diveOutputSchema = z.object({ dive: recordOutput });

export const diveTools = [
  defineTool({
    name: "list_dives",
    scope: "dives:read",
    title: "List dives",
    description:
      "Lists the dives of the logbook, optionally of one trip (one of this connection) or between two days (YYYY-MM-DD, both included). Paginated: pass nextCursor back as cursor.",
    input: z.object({ tripId: idInput.optional(), from: day.optional(), to: day.optional(), ...pageInput }),
    output: listOutput,
    annotations: READ,
    run: async ({ actor }, { tripId, from, to, cursor, limit = PAGE.default }) => {
      const { dives, tripNames } = await listDives(actor, { tripId, from, to, cursor, limit });
      return page(
        dives.map((dive) => diveOutput(actor, dive, tripNames)),
        limit,
      );
    },
  }),
  defineTool({
    name: "get_dive",
    scope: "dives:read",
    title: "Get a dive",
    description: "A dive of the logbook with its site and its equipment.",
    input: z.object({ diveId: idInput }),
    output: diveOutputSchema,
    annotations: READ,
    run: async ({ actor }, { diveId }) => {
      const { dive, tripNames } = await getDive(actor, diveId);
      const { diveSite, equipment, ...row } = dive;
      return {
        dive: {
          ...diveOutput(actor, row, tripNames),
          site: diveSite ? { id: diveSite.id, name: diveSite.name } : null,
          equipment: equipment.map((item) => ({ id: item.id, name: item.name })),
        },
      };
    },
  }),
  defineTool({
    name: "get_dive_profile",
    scope: "dives:read",
    title: "Get the profile of a dive",
    description: "The samples of a dive's profile: seconds from the start, depth in meters, temperature and no-decompression limit.",
    input: z.object({ diveId: idInput }),
    output: z.object({ samples: z.array(z.looseObject({ seconds: z.number() })) }),
    annotations: READ,
    run: async ({ actor }, { diveId }) => ({ samples: await getDiveProfile(actor, diveId) }),
  }),
  defineTool({
    name: "get_dive_stats",
    scope: "dives:read",
    title: "Get the logbook's statistics",
    description: "Totals of the logbook: dives, bottom time, depths, temperature, sites and countries, the first and last dive, and the deepest and longest.",
    input: z.object({}),
    output: z.looseObject({ totalDives: z.number() }),
    annotations: READ,
    run: async ({ actor }) => {
      const stats = await getDiveStats(actor);
      const record = (r: typeof stats.deepestDive) => (r ? { ...r, date: localDay(r.date) } : null);
      return {
        ...stats,
        firstDiveDate: stats.firstDiveDate ? localDay(stats.firstDiveDate) : null,
        lastDiveDate: stats.lastDiveDate ? localDay(stats.lastDiveDate) : null,
        deepestDive: record(stats.deepestDive),
        longestDive: record(stats.longestDive),
      };
    },
  }),
  defineTool({
    name: "create_dive",
    scope: "dives:write",
    title: "Log a dive",
    description: `Logs a dive; its number is given by its date among the others. date is YYYY-MM-DD and time HH:mm, local. diveSiteId, equipmentIds and tripId have to be the user's. ${TRIP_RULE} Same dive: same day and time, or same day and site with no time. ${DUPLICATES}`,
    input: diveLogInputSchema.extend({ force: z.boolean().optional() }),
    output: diveOutputSchema,
    annotations: CREATE,
    run: async ({ actor }, { force, ...input }) => {
      if (!force) {
        const existing = await duplicateOf.dive(actor, input);
        if (existing) throw new DuplicateError(diveOutput(actor, existing, new Map()));
      }
      const created = await createDiveLog(actor, input);
      return { dive: diveOutput(actor, created, new Map()) };
    },
  }),
  defineTool({
    name: "update_dive",
    scope: "dives:write",
    title: "Update a dive",
    description: `Changes the fields given of a dive and leaves the rest; null clears an optional field. ${TRIP_RULE}`,
    input: diveLogInputSchema.partial().extend({ diveId: idInput }),
    output: diveOutputSchema,
    annotations: EDIT,
    run: async ({ actor }, { diveId, ...input }) => {
      await updateDiveLog(actor, diveId, input);
      const { dive, tripNames } = await getDive(actor, diveId);
      const { diveSite: _site, equipment: _equipment, ...row } = dive;
      return { dive: diveOutput(actor, row, tripNames) };
    },
  }),
  defineTool({
    name: "link_dive_to_trip",
    scope: "dives:write",
    title: "Link a dive to a trip",
    description: `Links a dive to a trip, which then shows it. ${TRIP_RULE}`,
    input: z.object({ diveId: idInput, tripId: idInput }),
    output: diveOutputSchema,
    annotations: EDIT,
    run: async ({ actor }, { diveId, tripId }) => {
      await linkDiveToTrip(actor, diveId, tripId);
      const { dive, tripNames } = await getDive(actor, diveId);
      const { diveSite: _site, equipment: _equipment, ...row } = dive;
      return { dive: diveOutput(actor, row, tripNames) };
    },
  }),
  defineTool({
    name: "unlink_dive_from_trip",
    scope: "dives:write",
    title: "Unlink a dive from its trip",
    description: `Takes a dive out of its trip; the dive stays in the logbook. ${TRIP_RULE}`,
    input: z.object({ diveId: idInput }),
    output: diveOutputSchema,
    annotations: EDIT,
    run: async ({ actor }, { diveId }) => {
      await unlinkDiveFromTrip(actor, diveId);
      const { dive, tripNames } = await getDive(actor, diveId);
      const { diveSite: _site, equipment: _equipment, ...row } = dive;
      return { dive: diveOutput(actor, row, tripNames) };
    },
  }),
  defineTool({
    name: "list_dive_media",
    scope: "dives:read",
    title: "List the videos of a dive",
    description: "The clips of the media library around a dive: the ones attached by time and the ones of the same day to choose from.",
    input: z.object({ diveId: idInput }),
    output: z.looseObject({ clips: z.array(recordOutput) }),
    annotations: READ,
    mediaAdminOnly: true,
    run: async ({ actor }, { diveId }) => {
      const media = await listDiveMedia(actor, diveId);
      return { ...media, clips: media.clips.map((clip) => ({ ...clip, capturedAt: clip.capturedAt.toISOString() })) };
    },
  }),
  defineTool({
    name: "set_dive_media_link",
    scope: "dives:write",
    title: "Attach or detach videos of a dive",
    description:
      "For each clip, included: true attaches it to the dive, false detaches it, and null takes it back to the automatic match by time.",
    input: z.object({
      diveId: idInput,
      changes: z.array(z.object({ clipId: idInput, included: z.boolean().nullable() })).min(1).max(100),
    }),
    output: z.object({ diveId: z.string() }),
    annotations: EDIT,
    mediaAdminOnly: true,
    run: async ({ actor }, { diveId, changes }) => {
      await setDiveClipLinks(actor, diveId, changes);
      return { diveId };
    },
  }),
];
