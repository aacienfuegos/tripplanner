import "server-only";
import { prisma } from "@/lib/prisma";
import type { AgentLabels } from "@/components/agents/agent-badge";
import { AUDIT_RETENTION_MS } from "@/lib/services/audit";

type Marked = { readonly id: string; readonly agentGrantId: string | null };

// The names of the connections that marked these rows, only among the user's,
// and what the register of the last 90 days says the connection did: it
// created the row, it edited it, or nothing, because the entries have been
// purged. An accepted suggestion takes the suggestion's id, so its entry
// counts as the creation. A row whose connection isn't the user's gets no mark.
export async function getAgentLabels(userId: string, ...groups: readonly (readonly Marked[])[]): Promise<AgentLabels> {
  const marked = groups.flat().flatMap((row) => (row.agentGrantId ? [{ id: row.id, grantId: row.agentGrantId }] : []));
  if (marked.length === 0) return {};
  const [grants, entries] = await Promise.all([
    prisma.agentGrant.findMany({
      where: { id: { in: [...new Set(marked.map((row) => row.grantId))] }, userId },
      select: { id: true, name: true },
    }),
    prisma.agentAuditEntry.findMany({
      where: {
        userId,
        action: { in: ["CREATED", "SUGGESTED", "UPDATED"] },
        entityId: { in: marked.map((row) => row.id) },
        createdAt: { gte: new Date(Date.now() - AUDIT_RETENTION_MS) },
      },
      select: { entityId: true, grantId: true, action: true },
    }),
  ]);
  const names = new Map(grants.map((grant) => [grant.id, grant.name]));
  const done = new Set(
    entries.map((entry) => `${entry.entityId} ${entry.grantId} ${entry.action === "SUGGESTED" ? "CREATED" : entry.action}`),
  );
  return Object.fromEntries(
    marked.flatMap((row) => {
      const name = names.get(row.grantId);
      if (name === undefined) return [];
      const key = `${row.id} ${row.grantId}`;
      const action = done.has(`${key} CREATED`) ? "CREATED" : done.has(`${key} UPDATED`) ? "UPDATED" : null;
      return [[row.id, { name, action }]];
    }),
  );
}
