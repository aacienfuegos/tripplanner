import "server-only";
import { prisma } from "@/lib/prisma";
import type { AgentGrant, Scope } from "@/lib/services/actor";
import { LAST_USED_GRANULARITY_MS, isScope, type OAuthConfig } from "@/lib/oauth/config";
import { isInactive, revokeGrant } from "@/lib/oauth/grants";
import { secretHash } from "@/lib/oauth/tokens";

export type VerifiedToken = {
  readonly userId: string;
  readonly grant: AgentGrant;
  // The hash, never the value: this is what may travel further (AuthInfo.token).
  readonly tokenHash: string;
  readonly clientId: string;
  readonly expiresAt: Date;
};

// An access token is good while it is unexpired, for this resource, of a
// connection that is neither revoked nor inactive, of a client that still
// exists and of a user who is approved now. Pending or denied revokes nothing:
// approving the user again brings the connection back (CA17).
export async function verifyAccessToken(
  config: OAuthConfig,
  token: string,
  now: Date = new Date(),
): Promise<VerifiedToken | null> {
  if (!token.startsWith("tpat_") || token.length > 100) return null;
  const tokenHash = secretHash(token);
  const row = await prisma.oAuthToken.findUnique({
    where: { tokenHash },
    include: {
      grant: {
        include: {
          client: { select: { clientId: true, deletedAt: true } },
          user: { select: { status: true } },
          trips: { select: { tripId: true } },
        },
      },
    },
  });
  if (!row || row.kind !== "ACCESS" || row.expiresAt <= now || row.resource !== config.resource) return null;
  const { grant } = row;
  if (grant.revokedAt || grant.client.deletedAt || grant.user.status !== "APPROVED") return null;
  if (isInactive(grant.lastUsedAt, now)) {
    await revokeGrant(prisma, grant.id, "INACTIVE", now);
    return null;
  }
  if (now.getTime() - grant.lastUsedAt.getTime() > LAST_USED_GRANULARITY_MS) {
    await prisma.agentGrant.update({ where: { id: grant.id }, data: { lastUsedAt: now } });
  }
  return {
    userId: grant.userId,
    grant: {
      id: grant.id,
      allTrips: grant.allTrips,
      tripIds: new Set(grant.trips.map((trip) => trip.tripId)),
      scopes: new Set<Scope>(grant.scopes.filter(isScope)),
    },
    tokenHash,
    clientId: grant.client.clientId,
    expiresAt: row.expiresAt,
  };
}
