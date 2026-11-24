import "server-only";
import type { AgentAuditEntry, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AUDIT_RETENTION_MS } from "@/lib/services/audit";

export const AUDIT_PAGE_SIZE = 50;

export type AuditPage = {
  readonly entries: readonly AgentAuditEntry[];
  readonly tripNames: ReadonlyMap<string, string>;
  readonly hasMore: boolean;
};

// The register of the profile: only the user's entries and only the last 90
// days, the most recent first. A connection in the filter is looked for among
// the user's first: someone else's gives an empty list.
export async function listAuditEntries(
  userId: string,
  { grantId, page }: { grantId?: string; page: number },
): Promise<AuditPage> {
  if (grantId) {
    const grant = await prisma.agentGrant.findFirst({ where: { id: grantId, userId }, select: { id: true } });
    if (!grant) return { entries: [], tripNames: new Map(), hasMore: false };
  }
  const rows = await prisma.agentAuditEntry.findMany({
    where: {
      userId,
      createdAt: { gte: new Date(Date.now() - AUDIT_RETENTION_MS) },
      ...(grantId ? { grantId } : {}),
    },
    orderBy: { createdAt: "desc" },
    skip: page * AUDIT_PAGE_SIZE,
    take: AUDIT_PAGE_SIZE + 1,
  });
  const entries = rows.slice(0, AUDIT_PAGE_SIZE);
  const tripIds = [...new Set(entries.flatMap((entry) => (entry.tripId ? [entry.tripId] : [])))];
  const trips =
    tripIds.length > 0
      ? await prisma.trip.findMany({ where: { id: { in: tripIds }, userId }, select: { id: true, name: true } })
      : [];
  return {
    entries,
    tripNames: new Map(trips.map((trip) => [trip.id, trip.name])),
    hasMore: rows.length > AUDIT_PAGE_SIZE,
  };
}

const LABEL_FIELDS = ["name", "title", "description", "flightNumber", "city", "level"] as const;

// The name a deleted element had, from the row its entry keeps.
export function deletedLabel(snapshot: Prisma.JsonValue | null): string | null {
  if (typeof snapshot !== "object" || snapshot === null || Array.isArray(snapshot)) return null;
  for (const field of LABEL_FIELDS) {
    const value = snapshot[field];
    if (typeof value === "string" && value.trim() !== "") return value;
  }
  return null;
}
