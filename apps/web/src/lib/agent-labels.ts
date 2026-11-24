import "server-only";
import { prisma } from "@/lib/prisma";
import type { AgentLabels } from "@/components/agents/agent-badge";

type Marked = { readonly id: string; readonly agentGrantId: string | null };

// The names of the connections that marked these rows, only among the user's,
// and whether the connection created the row (its entry in the register) or
// edited it. An accepted suggestion takes the suggestion's id, so its entry
// counts as the creation. A row whose connection isn't the user's gets no mark.
export async function getAgentLabels(userId: string, ...groups: readonly (readonly Marked[])[]): Promise<AgentLabels> {
  const marked = groups.flat().flatMap((row) => (row.agentGrantId ? [{ id: row.id, grantId: row.agentGrantId }] : []));
  if (marked.length === 0) return {};
  const [grants, created] = await Promise.all([
    prisma.agentGrant.findMany({
      where: { id: { in: [...new Set(marked.map((row) => row.grantId))] }, userId },
      select: { id: true, name: true },
    }),
    prisma.agentAuditEntry.findMany({
      where: { userId, action: { in: ["CREATED", "SUGGESTED"] }, entityId: { in: marked.map((row) => row.id) } },
      select: { entityId: true, grantId: true },
    }),
  ]);
  const names = new Map(grants.map((grant) => [grant.id, grant.name]));
  const createdBy = new Set(created.map((entry) => `${entry.entityId} ${entry.grantId}`));
  return Object.fromEntries(
    marked.flatMap((row) => {
      const name = names.get(row.grantId);
      return name === undefined ? [] : [[row.id, { name, added: createdBy.has(`${row.id} ${row.grantId}`) }]];
    }),
  );
}
