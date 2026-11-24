import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { timingSafeStringEqual } from "@/lib/timing-safe";
import type { Scope } from "@/lib/services/actor";
import { CODE_TTL_MS, MAX_ACTIVE_GRANTS, isScope, withImpliedScopes, type OAuthConfig } from "@/lib/oauth/config";
import { clientRedirect } from "@/lib/oauth/authorize";
import { MAX_NAME_LENGTH } from "@/lib/oauth/client-rules";
import { activeGrantsWhere, lockUser, type TxClient } from "@/lib/oauth/grants";
import { generateSecret, secretHash } from "@/lib/oauth/tokens";

const checkbox = z.enum(["on"]).optional().transform((value) => value === "on");

export const consentSchema = z.object({
  requestId: z.string().min(1).max(100),
  csrfToken: z.string().max(100).default(""),
  decision: z.enum(["allow", "deny"]),
  name: z.string().trim().max(MAX_NAME_LENGTH).default(""),
  tripsMode: z.enum(["all", "some"]).default("some"),
  tripIds: z.array(z.string().max(100)).max(500).default([]),
  dives: z.enum(["none", "read", "write"]).default("none"),
  divesDelete: checkbox,
  tripsSuggest: checkbox,
  tripsWrite: checkbox,
  tripsDelete: checkbox,
});

export type ConsentError = "invalid" | "expired" | "csrf" | "invalid_trips" | "no_scopes" | "limit";

export type ConsentResult = { readonly location: string } | { readonly error: ConsentError };

// The form as it arrives; consentSchema decides what is valid.
export function consentInputFromForm(formData: FormData): Record<string, unknown> {
  const entries = [...formData.entries()].filter(([key, value]) => key !== "tripIds" && typeof value === "string");
  return {
    ...Object.fromEntries(entries),
    tripIds: formData.getAll("tripIds").filter((value) => typeof value === "string"),
  };
}

// What the user ticked, limited to what the client asked for: the reads come
// with what implies them, and nothing that wasn't requested is ever granted.
function grantedScopes(requested: ReadonlySet<Scope>, input: z.output<typeof consentSchema>): Set<Scope> {
  const chosen = new Set<Scope>(["trips:read", "offline_access"]);
  if (input.tripsSuggest) chosen.add("trips:suggest");
  if (input.tripsWrite) chosen.add("trips:write");
  if (input.tripsDelete) chosen.add("trips:delete");
  if (input.dives !== "none") chosen.add("dives:read");
  if (input.dives === "write") chosen.add("dives:write");
  if (input.dives !== "none" && input.divesDelete) chosen.add("dives:delete");
  return new Set([...withImpliedScopes(chosen)].filter((scope) => requested.has(scope)));
}

// The server action of the consent screen. The request has to be the user's,
// unexpired and unused, with its CSRF token; it is consumed in the same
// transaction that creates the connection and the code.
export async function decideConsent(
  config: OAuthConfig,
  userId: string,
  raw: unknown,
  now: Date = new Date(),
): Promise<ConsentResult> {
  const parsed = consentSchema.safeParse(raw);
  if (!parsed.success) return { error: "invalid" };
  const input = parsed.data;

  const request = await prisma.oAuthAuthorizationRequest.findUnique({
    where: { id: input.requestId, userId },
    include: { client: { select: { name: true, deletedAt: true } } },
  });
  if (!request) return { error: "expired" };
  if (!timingSafeStringEqual(secretHash(input.csrfToken), request.csrfTokenHash)) return { error: "csrf" };
  if (request.consumedAt || request.expiresAt <= now || request.client.deletedAt) return { error: "expired" };

  const consume = (tx: TxClient) =>
    tx.oAuthAuthorizationRequest.updateMany({
      where: { id: request.id, userId, consumedAt: null, expiresAt: { gt: now } },
      data: { consumedAt: now },
    });

  if (input.decision === "deny") {
    const { count } = await prisma.$transaction((tx) => consume(tx));
    if (count !== 1) return { error: "expired" };
    return { location: clientRedirect(config, request.redirectUri, request.state, { error: "access_denied" }) };
  }

  const requested = new Set(request.requestedScopes.filter(isScope));
  const scopes = grantedScopes(requested, input);
  if (!scopes.has("trips:read") && !scopes.has("dives:read")) return { error: "no_scopes" };

  const tripAccess = scopes.has("trips:read");
  const allTrips = tripAccess && input.tripsMode === "all";
  const tripIds = tripAccess && !allTrips ? [...new Set(input.tripIds)] : [];
  if (tripIds.length > 0) {
    const owned = await prisma.trip.findMany({ where: { id: { in: tripIds }, userId }, select: { id: true } });
    if (owned.length !== tripIds.length) return { error: "invalid_trips" };
  }
  const name = input.name || request.client.name.slice(0, MAX_NAME_LENGTH);

  return prisma.$transaction(async (tx): Promise<ConsentResult> => {
    await lockUser(tx, userId);
    if ((await tx.agentGrant.count({ where: activeGrantsWhere(userId, now) })) >= MAX_ACTIVE_GRANTS) {
      return { error: "limit" };
    }
    const { count } = await consume(tx);
    if (count !== 1) return { error: "expired" };

    const grant = await tx.agentGrant.create({
      data: { userId, clientId: request.clientId, name, allTrips, scopes: [...scopes], lastUsedAt: now },
      select: { id: true },
    });
    if (tripIds.length > 0) {
      await tx.agentGrantTrip.createMany({ data: tripIds.map((tripId) => ({ grantId: grant.id, tripId })) });
    }
    await tx.oAuthCode.deleteMany({ where: { expiresAt: { lt: now } } });
    const code = generateSecret("tpac_");
    await tx.oAuthCode.create({
      data: {
        codeHash: secretHash(code),
        grantId: grant.id,
        redirectUri: request.redirectUri,
        codeChallenge: request.codeChallenge,
        resource: request.resource,
        expiresAt: new Date(now.getTime() + CODE_TTL_MS),
      },
    });
    return { location: clientRedirect(config, request.redirectUri, request.state, { code }) };
  });
}
