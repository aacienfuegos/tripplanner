import "server-only";
import { prisma } from "@/lib/prisma";
import { INACTIVITY_MS } from "@/lib/oauth/config";

// Derived from the extended client's own $transaction, as in dive-numbering.ts.
export type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
type Db = typeof prisma | TxClient;

export type RevokedReason = "USER" | "CLIENT_DELETED" | "TOKEN_REUSE" | "INACTIVE";

// Ninety days without use count as revoked in every check, so no scheduled job
// is needed: the first check that notices marks it INACTIVE.
export function isInactive(lastUsedAt: Date, now: Date): boolean {
  return now.getTime() - lastUsedAt.getTime() > INACTIVITY_MS;
}

export function activeGrantsWhere(userId: string, now: Date) {
  return { userId, revokedAt: null, lastUsedAt: { gt: new Date(now.getTime() - INACTIVITY_MS) } };
}

// Serialises the writes that check a per-user limit (clients, connections):
// two requests at once would otherwise both see room for one more.
export async function lockUser(tx: TxClient, userId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
}

async function dropCredentials(db: Db, grantIds: readonly string[]): Promise<void> {
  if (grantIds.length === 0) return;
  await db.oAuthToken.deleteMany({ where: { grantId: { in: [...grantIds] } } });
  await db.oAuthCode.deleteMany({ where: { grantId: { in: [...grantIds] } } });
}

// Revokes a connection that is still active and deletes its tokens and codes.
export async function revokeGrant(db: Db, grantId: string, reason: RevokedReason, now: Date): Promise<boolean> {
  const { count } = await db.agentGrant.updateMany({
    where: { id: grantId, revokedAt: null },
    data: { revokedAt: now, revokedReason: reason },
  });
  if (count === 1) await dropCredentials(db, [grantId]);
  return count === 1;
}

// "Revocar" in the profile. The owner goes in the where: with someone else's
// id nothing matches and nothing is deleted.
export async function revokeUserGrant(userId: string, grantId: string, now: Date): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.agentGrant.updateMany({
      where: { id: grantId, userId, revokedAt: null },
      data: { revokedAt: now, revokedReason: "USER" },
    });
    if (count === 1) await dropCredentials(tx, [grantId]);
    return count === 1;
  });
}

// Deleting a manual client revokes its connections at once. They are all its
// owner's: a manual client is only authorised by its owner.
export async function deleteManualClient(userId: string, id: string, now: Date): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.oAuthClient.updateMany({
      where: { id, ownerUserId: userId, deletedAt: null },
      data: { deletedAt: now },
    });
    if (count !== 1) return false;
    await tx.agentGrant.updateMany({
      where: { clientId: id, revokedAt: null },
      data: { revokedAt: now, revokedReason: "CLIENT_DELETED" },
    });
    const grants = await tx.agentGrant.findMany({ where: { clientId: id }, select: { id: true } });
    await dropCredentials(
      tx,
      grants.map((grant) => grant.id),
    );
    return true;
  });
}

export async function countActiveGrants(userId: string, now: Date): Promise<number> {
  return prisma.agentGrant.count({ where: activeGrantsWhere(userId, now) });
}

export async function listUserGrants(userId: string) {
  return prisma.agentGrant.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      allTrips: true,
      scopes: true,
      createdAt: true,
      lastUsedAt: true,
      revokedAt: true,
      revokedReason: true,
      client: { select: { id: true, clientId: true, kind: true, name: true, createdAt: true } },
      trips: { select: { trip: { select: { id: true, name: true } } } },
    },
  });
}

export async function listManualClients(userId: string) {
  return prisma.oAuthClient.findMany({
    where: { ownerUserId: userId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, clientId: true, name: true, redirectUris: true, createdAt: true },
  });
}
