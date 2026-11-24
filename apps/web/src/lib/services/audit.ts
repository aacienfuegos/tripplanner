import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { Actor } from "@/lib/services/actor";
import { ConflictError, LimitError, NotFoundError, type Entity } from "@/lib/services/errors";

// The register and the mark of what the agents write. An agent's write and
// its entry go in one transaction; the web writes as it always did, without
// one, and clears the mark of the element it touches.

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
export type Db = typeof prisma | TxClient;

export const AUDIT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
export const DELETE_LIMIT = 20;
export const DELETE_WINDOW_MS = 24 * 60 * 60 * 1000;

// Columns the services derive on their own: they change with an edit but
// aren't what the agent changed.
const DERIVED = new Set([
  "updatedAt",
  "agentGrantId",
  "latitude",
  "longitude",
  "exchangeRate",
  "convertedAmount",
  "diveNumber",
  "order",
]);

type Row = Readonly<Record<string, unknown>>;
type Target = { readonly entity: Entity; readonly tripId?: string | null };
type AuditValue = string | number | boolean | null;
export type AuditChanges = Record<string, [AuditValue, AuditValue]>;

export function markOf(actor: Actor): { agentGrantId: string | null } {
  return { agentGrantId: actor.kind === "agent" ? actor.grant.id : null };
}

const pad = (n: number) => String(n).padStart(2, "0");

// Dates in the format the agents write them: local time, the time only if
// there is one. A relation list (the equipment of a dive) as its sorted ids.
function auditValue(value: unknown): AuditValue {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) {
    const day = `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
    const time = `${pad(value.getHours())}:${pad(value.getMinutes())}`;
    return time === "00:00" ? day : `${day}T${time}`;
  }
  if (Array.isArray(value)) {
    return value
      .map((item: unknown) => (typeof item === "object" && item !== null && "id" in item ? String(item.id) : String(item)))
      .sort()
      .join(", ");
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return String(value);
}

export function diffRows(before: Row, after: Row): AuditChanges {
  const changes: AuditChanges = {};
  for (const key of Object.keys(after)) {
    if (DERIVED.has(key)) continue;
    const old = auditValue(before[key]);
    const now = auditValue(after[key]);
    if (old !== now) changes[key] = [old, now];
  }
  return changes;
}

type AgentActor = Extract<Actor, { kind: "agent" }>;

type AuditAction = "CREATED" | "UPDATED" | "DELETED" | "SUGGESTED";

export function auditEntryData(
  actor: AgentActor,
  target: Target,
  entityId: string,
  action: AuditAction,
  changes?: AuditChanges,
) {
  return {
    userId: actor.userId,
    grantId: actor.grant.id,
    tripId: target.tripId ?? null,
    entityType: target.entity,
    entityId,
    action,
    changes,
  };
}

// Every write also drops the user's entries older than 90 days: no scheduled
// job is needed.
export function purgeOldEntries(db: Db, userId: string, now: Date = new Date()) {
  return db.agentAuditEntry.deleteMany({
    where: { userId, createdAt: { lt: new Date(now.getTime() - AUDIT_RETENTION_MS) } },
  });
}

async function writeEntry(
  tx: Db,
  actor: AgentActor,
  target: Target,
  entityId: string,
  action: AuditAction,
  changes?: AuditChanges,
) {
  await tx.agentAuditEntry.create({ data: auditEntryData(actor, target, entityId, action, changes) });
  await purgeOldEntries(tx, actor.userId);
}

export async function auditedCreate<T extends { id: string }>(
  actor: Actor,
  target: Target,
  create: (db: Db, mark: { agentGrantId: string | null }) => Promise<T>,
): Promise<T> {
  if (actor.kind === "web") return create(prisma, markOf(actor));
  return prisma.$transaction(async (tx) => {
    const created = await create(tx, markOf(actor));
    await writeEntry(tx, actor, target, created.id, "CREATED");
    return created;
  });
}

// `read` gives the row before the edit, with the same owner filter as the
// write: with someone else's id it finds nothing and nothing is written.
export async function auditedUpdate<T extends Row>(
  actor: Actor,
  target: Target & { readonly id: string },
  read: (db: Db) => Promise<Row | null>,
  update: (db: Db, mark: { agentGrantId: string | null }) => Promise<T>,
): Promise<T> {
  if (actor.kind === "web") return update(prisma, markOf(actor));
  return prisma.$transaction(async (tx) => {
    const before = await read(tx);
    if (!before) throw new NotFoundError(target.entity);
    const after = await update(tx, markOf(actor));
    await writeEntry(tx, actor, target, target.id, "UPDATED", diffRows(before, after));
    return after;
  });
}

// A row as JSON, the way it is stored and read back: dates become ISO strings,
// which Prisma takes again for a DateTime column.
export function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

// An agent deletes one element per call, at most DELETE_LIMIT per connection in
// DELETE_WINDOW_MS. The connection's row is locked before counting, so two
// deletions of the same connection run one after the other and the second sees
// the entry of the first. The entry keeps the whole row to restore it. `linked`
// counts what stops the deletion (only for an agent: the web keeps deleting as
// it always did), with the same owner filter as the delete.
export async function auditedDelete<T extends Row & { id: string }>(
  actor: Actor,
  target: Target & { readonly id: string },
  remove: (db: Db) => Promise<T>,
  linked?: (db: Db) => Promise<Readonly<Record<string, number>>>,
): Promise<T> {
  if (actor.kind === "web") return remove(prisma);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "AgentGrant" WHERE id = ${actor.grant.id} FOR UPDATE`;
    const now = Date.now();
    const recent = { grantId: actor.grant.id, action: "DELETED" as const, createdAt: { gte: new Date(now - DELETE_WINDOW_MS) } };
    if ((await tx.agentAuditEntry.count({ where: recent })) >= DELETE_LIMIT) {
      const oldest = await tx.agentAuditEntry.findFirst({ where: recent, orderBy: { createdAt: "asc" }, select: { createdAt: true } });
      const freeAt = (oldest?.createdAt.getTime() ?? now) + DELETE_WINDOW_MS;
      throw new LimitError(Math.max(1, Math.ceil((freeAt - now) / 1000)));
    }
    if (linked) {
      const counts = Object.fromEntries(Object.entries(await linked(tx)).filter(([, n]) => n > 0));
      if (Object.keys(counts).length > 0) throw new ConflictError(counts);
    }
    const removed = await remove(tx);
    await tx.agentAuditEntry.create({
      data: { ...auditEntryData(actor, target, target.id, "DELETED"), snapshot: toJson(removed) },
    });
    await purgeOldEntries(tx, actor.userId);
    return removed;
  });
}
