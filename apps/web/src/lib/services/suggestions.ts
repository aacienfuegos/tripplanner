import "server-only";
import type { AgentSuggestion, AgentSuggestionKind } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { geocodeAccommodation, geocodeActivity } from "@/lib/geocode-items";
import {
  accommodationInputSchema,
  activityInputSchema,
  type AccommodationInput,
  type ActivityInput,
} from "@/lib/agent-schemas";
import type { Actor } from "@/lib/services/actor";
import { requireTrip } from "@/lib/services/access";
import { AUDIT_RETENTION_MS, auditEntryData, purgeOldEntries, toJson } from "@/lib/services/audit";
import { LimitError, NotFoundError, parseInput } from "@/lib/services/errors";
import { accommodationData } from "@/lib/services/accommodations";
import { activityData } from "@/lib/services/activities";
import type { Page } from "@/lib/services/trip-reads";

// What an agent with trips:suggest proposes for a trip. A suggestion lives in
// its own table, so it isn't on the map, the timeline, the expenses or the
// counters until the user accepts it. Accepting and dismissing are conditioned
// on the suggestion still being pending and on a trip of the user, in the same
// write: of two at once only one gets through, and an id from someone else
// changes nothing.

type AgentActor = Extract<Actor, { kind: "agent" }>;

const SECTION = { ACCOMMODATION: "accommodations", ACTIVITY: "activities" } as const;
const ENTITY = { ACCOMMODATION: "Accommodation", ACTIVITY: "Activity" } as const;

export const PENDING_LIMIT = 50;
export const PENDING_SHOWN = 20;

// A connection keeps at most PENDING_LIMIT pending in a trip, so an agent in a
// loop can't bury the trip's pages. Its row is locked before counting, as for
// deleting. The room comes back as the user accepts or dismisses, so the limit
// error has no wait. The same write drops the user's suggestions resolved more
// than 90 days ago, like the register.
async function suggest(actor: AgentActor, tripId: string, kind: AgentSuggestionKind, payload: unknown) {
  const suggestion = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "AgentGrant" WHERE id = ${actor.grant.id} FOR UPDATE`;
    const pending = await tx.agentSuggestion.count({ where: { tripId, grantId: actor.grant.id, status: "PENDING" } });
    if (pending >= PENDING_LIMIT) throw new LimitError(null, "Too many pending suggestions in this trip; nothing was suggested");
    const created = await tx.agentSuggestion.create({
      data: { tripId, grantId: actor.grant.id, kind, payload: toJson(payload) },
    });
    await tx.agentAuditEntry.create({
      data: auditEntryData(actor, { entity: ENTITY[kind], tripId }, created.id, "SUGGESTED"),
    });
    await purgeOldEntries(tx, actor.userId);
    await tx.agentSuggestion.deleteMany({
      where: { trip: { userId: actor.userId }, resolvedAt: { lt: new Date(Date.now() - AUDIT_RETENTION_MS) } },
    });
    return created;
  });
  revalidatePath(`/trips/${tripId}/${SECTION[kind]}`);
  return suggestion;
}

// The same input and checks as creating one.
export async function suggestAccommodation(actor: AgentActor, tripId: string, input: AccommodationInput) {
  await requireTrip(actor, tripId);
  return suggest(actor, tripId, "ACCOMMODATION", parseInput(accommodationInputSchema, input));
}

export async function suggestActivity(actor: AgentActor, tripId: string, input: ActivityInput) {
  await requireTrip(actor, tripId);
  return suggest(actor, tripId, "ACTIVITY", parseInput(activityInputSchema, input));
}

// The connection's own suggestions, in the trips it still reaches.
export async function listSuggestions(actor: AgentActor, { tripId, cursor, limit }: Page & { readonly tripId?: string }) {
  if (tripId) await requireTrip(actor, tripId);
  const reach = actor.grant.allTrips ? undefined : { in: [...actor.grant.tripIds] };
  return prisma.agentSuggestion.findMany({
    where: {
      grantId: actor.grant.id,
      trip: { userId: actor.userId },
      tripId: tripId ?? reach,
      ...(cursor ? { id: { gt: cursor } } : {}),
    },
    orderBy: { id: "asc" },
    take: limit + 1,
  });
}

// For the trip's page: the first PENDING_SHOWN pending of one kind, with the
// name of the connection that suggested it, and whether there are more.
export async function listPendingSuggestions(
  userId: string,
  tripId: string,
  kind: AgentSuggestionKind,
): Promise<{ suggestions: (AgentSuggestion & { grantName: string | null })[]; more: boolean }> {
  const found = await prisma.agentSuggestion.findMany({
    where: { tripId, kind, status: "PENDING", trip: { userId } },
    orderBy: { createdAt: "asc" },
    take: PENDING_SHOWN + 1,
  });
  const more = found.length > PENDING_SHOWN;
  const suggestions = found.slice(0, PENDING_SHOWN);
  if (suggestions.length === 0) return { suggestions: [], more };
  const grants = await prisma.agentGrant.findMany({
    where: { id: { in: [...new Set(suggestions.map((s) => s.grantId))] }, userId },
    select: { id: true, name: true },
  });
  const names = new Map(grants.map((grant) => [grant.id, grant.name]));
  return { suggestions: suggestions.map((s) => ({ ...s, grantName: names.get(s.grantId) ?? null })), more };
}

const pendingOf = (actor: Actor, tripId: string, id: string) => ({
  id,
  tripId,
  status: "PENDING" as const,
  trip: { userId: actor.userId },
});

// Accepting creates the element as the user would, without the duplicate
// check, with the mark of the connection that suggested it. It takes the
// suggestion's id, so the suggestion's entry in the register is its creation.
export async function acceptSuggestion(actor: Actor, tripId: string, id: string) {
  await requireTrip(actor, tripId);
  const pending = pendingOf(actor, tripId, id);
  const suggestion = await prisma.agentSuggestion.findFirst({ where: pending });
  if (!suggestion) throw new NotFoundError("Suggestion");
  const mark = { agentGrantId: suggestion.grantId, id: suggestion.id, tripId };
  const accommodation =
    suggestion.kind === "ACCOMMODATION" ? parseInput(accommodationInputSchema, suggestion.payload) : null;
  const activity = suggestion.kind === "ACTIVITY" ? parseInput(activityInputSchema, suggestion.payload) : null;

  await prisma.$transaction(async (tx) => {
    const claimed = await tx.agentSuggestion.updateMany({
      where: pending,
      data: { status: "ACCEPTED", resolvedAt: new Date(), resultId: suggestion.id },
    });
    if (claimed.count !== 1) throw new NotFoundError("Suggestion");
    if (accommodation) await tx.accommodation.create({ data: { ...accommodationData(accommodation), ...mark } });
    if (activity) await tx.activity.create({ data: { ...activityData(activity), ...mark } });
  });

  if (accommodation) void geocodeAccommodation(suggestion.id);
  if (activity) void geocodeActivity(suggestion.id);
  revalidatePath(`/trips/${tripId}/${SECTION[suggestion.kind]}`);
}

export async function dismissSuggestion(actor: Actor, tripId: string, id: string) {
  await requireTrip(actor, tripId);
  const { count } = await prisma.agentSuggestion.updateMany({
    where: pendingOf(actor, tripId, id),
    data: { status: "DISMISSED", resolvedAt: new Date() },
  });
  if (count !== 1) throw new NotFoundError("Suggestion");
  revalidatePath(`/trips/${tripId}/accommodations`);
  revalidatePath(`/trips/${tripId}/activities`);
}
