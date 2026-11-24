import "server-only";
import { OAuthError, OAuthErrorCode, type AuthInfo, type OAuthTokenVerifier } from "@modelcontextprotocol/server";
import { prisma } from "@/lib/prisma";
import type { Actor, AgentGrant, Scope } from "@/lib/services/actor";
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

export type AgentActor = Extract<Actor, { kind: "agent" }>;

// The actor of a verified token, keyed by the AuthInfo.extra object the
// verifier made: nothing that reaches the SDK from outside can stand for one.
const actors = new WeakMap<object, AgentActor>();

// The verifier of /api/mcp. AuthInfo.token carries the hash, never the value:
// AuthInfo travels into the SDK and its handlers.
export function mcpTokenVerifier(config: OAuthConfig, resourceMetadataUrl: string): OAuthTokenVerifier {
  return {
    async verifyAccessToken(token: string): Promise<AuthInfo> {
      const verified = await verifyAccessToken(config, token);
      if (!verified) throw new OAuthError(OAuthErrorCode.InvalidToken, "Invalid or expired token");
      const extra = {};
      actors.set(extra, { kind: "agent", userId: verified.userId, grant: verified.grant });
      return {
        token: verified.tokenHash,
        clientId: verified.clientId,
        scopes: [...verified.grant.scopes],
        expiresAt: Math.floor(verified.expiresAt.getTime() / 1000),
        resource: new URL(config.resource),
        resourceMetadataUrl,
        extra,
      };
    },
  };
}

export function actorOf(authInfo: AuthInfo | undefined): AgentActor | null {
  return (authInfo?.extra && actors.get(authInfo.extra)) || null;
}
