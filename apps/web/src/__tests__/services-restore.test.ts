import { describe, it, expect, vi, beforeEach } from "vitest";
import { geocodeActivity, geocodeDiveSite } from "@/lib/geocode-items";
import { deleteActivity } from "@/lib/services/activities";
import { deleteExpense } from "@/lib/services/expenses";
import { deleteDiveSite } from "@/lib/services/dive-sites";
import { deleteDiveEquipmentService } from "@/lib/services/dive-equipment";
import { restoreDeletion } from "@/lib/services/restore";
import { AUDIT_RETENTION_MS } from "@/lib/services/audit";
import { NotFoundError } from "@/lib/services/errors";
import { A, B, fakeServiceDb, fakeServicePrisma } from "./helpers/fake-service-db";
import { agentActor, webActorOf } from "./helpers/actors";
import { seedForTools } from "./helpers/mcp-tools";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers/fake-service-db")).fakeServicePrisma }));
vi.mock("@/lib/geocode-items", () => ({ geocodeAccommodation: vi.fn(), geocodeActivity: vi.fn(), geocodeDiveSite: vi.fn() }));
vi.mock("@/lib/exchangeRate", () => ({ getExchangeRate: vi.fn(async () => 2) }));

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  seedForTools();
});

const row = (table: Parameters<typeof fakeServiceDb.rows>[0], id: string) =>
  fakeServiceDb.rows(table).find((r) => r.id === id);
const entryOf = (entityId: string) =>
  fakeServiceDb.rows("agentAuditEntry").find((entry) => entry.entityId === entityId && entry.action === "DELETED")!;

async function expectNotFound(run: Promise<unknown>, entity: string) {
  const before = fakeServiceDb.dump();
  await expect(run).rejects.toThrow(NotFoundError);
  await run.catch((error: NotFoundError) => expect(error.entity).toBe(entity));
  expect(fakeServiceDb.dump()).toEqual(before);
}

describe.each([
  [A, B],
  [B, A],
])("restoring as %s what an agent deleted, with the entries of %s", (me, other) => {
  const agent = () => agentActor(me, "all");
  const web = () => webActorOf(me);

  it("an activity comes back with its id and its data, without the mark, and goes to the map again (CA12)", async () => {
    const original = structuredClone(row("activity", `act-${me}`)!);
    row("activity", `act-${me}`)!.agentGrantId = `grant-${me}`;
    await deleteActivity(agent(), `trip-${me}`, `act-${me}`);
    expect(row("activity", `act-${me}`)).toBeUndefined();

    await restoreDeletion(web(), entryOf(`act-${me}`).id as string);

    expect(row("activity", `act-${me}`)).toMatchObject({
      id: `act-${me}`,
      tripId: `trip-${me}`,
      name: original.name,
      scheduledAt: (original.scheduledAt as Date).toISOString(),
      agentGrantId: null,
    });
    expect(entryOf(`act-${me}`).restoredAt).toBeInstanceOf(Date);
    expect(geocodeActivity).toHaveBeenCalledWith(`act-${me}`);
  });

  it("a site comes back as the actor's, whatever user the snapshot says, and goes to the map again (CA15)", async () => {
    await deleteDiveSite(agent(), `site-${me}`);
    (entryOf(`site-${me}`).snapshot as Record<string, unknown>).userId = other;

    await restoreDeletion(web(), entryOf(`site-${me}`).id as string);

    expect(row("diveSite", `site-${me}`)).toMatchObject({ userId: me, name: "Bajo de Dentro", agentGrantId: null });
    expect(geocodeDiveSite).toHaveBeenCalledWith(`site-${me}`);
  });

  it("an expense is converted again against the trip's currency of today", async () => {
    await deleteExpense(agent(), `trip-${me}`, `exp-${me}`);
    row("trip", `trip-${me}`)!.currency = "USD";

    await restoreDeletion(web(), entryOf(`exp-${me}`).id as string);

    expect(row("expense", `exp-${me}`)).toMatchObject({ amount: 10, currency: "EUR", exchangeRate: 2, convertedAmount: 20 });
  });

  it("with its trip deleted it isn't restored, and the entry stays as it was", async () => {
    await deleteActivity(agent(), `trip-${me}`, `act-${me}`);
    const trips = fakeServiceDb.rows("trip");
    trips.splice(trips.findIndex((trip) => trip.id === `trip-${me}`), 1);

    await expectNotFound(restoreDeletion(web(), entryOf(`act-${me}`).id as string), "Trip");
    expect(entryOf(`act-${me}`).restoredAt).toBeNull();
  });

  it("a snapshot pointing at the other user's trip isn't restored there", async () => {
    await deleteActivity(agent(), `trip-${me}`, `act-${me}`);
    (entryOf(`act-${me}`).snapshot as Record<string, unknown>).tripId = `trip-${other}`;

    await expectNotFound(restoreDeletion(web(), entryOf(`act-${me}`).id as string), "Trip");
    expect(row("activity", `act-${me}`)).toBeUndefined();
  });

  it("a service record whose equipment is gone isn't restored", async () => {
    await deleteDiveEquipmentService(agent(), `svc-${me}`);
    const equipment = fakeServiceDb.rows("diveEquipment");
    equipment.splice(equipment.findIndex((item) => item.id === `eq-${me}`), 1);

    await expectNotFound(restoreDeletion(web(), entryOf(`svc-${me}`).id as string), "Equipment");
  });

  it("the same entry twice restores once", async () => {
    await deleteActivity(agent(), `trip-${me}`, `act-${me}`);
    const id = entryOf(`act-${me}`).id as string;
    await restoreDeletion(web(), id);

    await expectNotFound(restoreDeletion(web(), id), "Register entry");
    expect(fakeServiceDb.rows("activity").filter((activity) => activity.id === `act-${me}`)).toHaveLength(1);
  });

  it("if another request marks the entry first, nothing is created", async () => {
    await deleteActivity(agent(), `trip-${me}`, `act-${me}`);
    const mark = vi.spyOn(fakeServicePrisma.agentAuditEntry, "updateMany").mockResolvedValueOnce({ count: 0 });

    await expectNotFound(restoreDeletion(web(), entryOf(`act-${me}`).id as string), "Register entry");
    expect(mark).toHaveBeenCalledWith({
      where: expect.objectContaining({ userId: me, action: "DELETED", restoredAt: null }),
      data: { restoredAt: expect.any(Date) },
    });
    expect(row("activity", `act-${me}`)).toBeUndefined();
  });

  it("the other user's entry, or one older than 90 days, is not found", async () => {
    await deleteActivity(agentActor(other, "all"), `trip-${other}`, `act-${other}`);
    await expectNotFound(restoreDeletion(web(), entryOf(`act-${other}`).id as string), "Register entry");
    expect(row("activity", `act-${other}`)).toBeUndefined();

    await deleteActivity(agent(), `trip-${me}`, `act-${me}`);
    entryOf(`act-${me}`).createdAt = new Date(Date.now() - AUDIT_RETENTION_MS - 60_000);
    await expectNotFound(restoreDeletion(web(), entryOf(`act-${me}`).id as string), "Register entry");
  });
});
