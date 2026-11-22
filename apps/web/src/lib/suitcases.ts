import type { Prisma } from "@prisma/client";
import { foldText, resolveSuitcaseNames, type SuitcaseType } from "@tripplanner/shared";

// Used by the AI import and by "copy from another trip": reuses the trip's bags
// whose name matches by foldText and creates the missing ones, without weight.
// Returns the bag id for each folded name, and how many bags were created.
export async function ensureSuitcases(
  tx: Prisma.TransactionClient,
  tripId: string,
  wanted: readonly { readonly name: string | null | undefined; readonly type: SuitcaseType }[],
): Promise<{ ids: Map<string, string>; created: number }> {
  const existing = await tx.suitcase.findMany({
    where: { tripId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  const { matched, toCreate } = resolveSuitcaseNames(existing, wanted.map((w) => w.name));
  if (toCreate.length === 0) return { ids: matched, created: 0 };

  const typeByKey = new Map<string, SuitcaseType>();
  for (const w of wanted) {
    const key = foldText(w.name ?? "");
    if (!typeByKey.has(key)) typeByKey.set(key, w.type);
  }
  const created = await tx.suitcase.createManyAndReturn({
    data: toCreate.map((name) => ({ tripId, name, type: typeByKey.get(foldText(name)) ?? "OTHER" })),
    select: { id: true, name: true },
  });
  const ids = new Map(matched);
  for (const s of created) ids.set(foldText(s.name), s.id);
  return { ids, created: created.length };
}
