// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { deleteActivity } from "@/lib/services/activities";
import { A, B, dbCalls, fakeServiceDb } from "./helpers/fake-service-db";
import { agentActor, webActorOf } from "./helpers/actors";
import { call, seedForTools } from "./helpers/mcp-tools";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers/fake-service-db")).fakeServicePrisma }));
vi.mock("@/lib/geocode-items", () => ({ geocodeAccommodation: vi.fn(), geocodeActivity: vi.fn(), geocodeDiveSite: vi.fn() }));
vi.mock("@/lib/exchangeRate", () => ({ getExchangeRate: vi.fn(async () => 2) }));

beforeEach(() => {
  vi.clearAllMocks();
  seedForTools();
});

const HOUR = 60 * 60 * 1000;
const as = (user: string, trips: readonly string[] | "all") => ({ actor: agentActor(user, trips), mediaAdmin: false });
const row = (table: Parameters<typeof fakeServiceDb.rows>[0], id: string) =>
  fakeServiceDb.rows(table).find((r) => r.id === id);
const deletions = (grantId: string) =>
  fakeServiceDb.rows("agentAuditEntry").filter((entry) => entry.grantId === grantId && entry.action === "DELETED");

// `n` deletions of the connection, the oldest `oldestHoursAgo` ago.
function pastDeletions(user: string, n: number, oldestHoursAgo: number) {
  for (let i = 0; i < n; i++) {
    fakeServiceDb.rows("agentAuditEntry").push({
      id: `past-${user}-${oldestHoursAgo}-${i}`,
      userId: user,
      grantId: `grant-${user}`,
      createdAt: new Date(Date.now() - (oldestHoursAgo - i * 0.01) * HOUR),
      tripId: `trip-${user}`,
      entityType: "Task",
      entityId: `gone-${i}`,
      action: "DELETED",
      changes: null,
      snapshot: { id: `gone-${i}` },
      restoredAt: null,
    });
  }
}

describe.each([
  [A, B],
  [B, A],
])("deleting as %s's agent, with the ids of %s", (me, other) => {
  it("deletes an activity, and the register keeps the whole row to restore it (CA12, CA20)", async () => {
    const result = await call(as(me, [`trip-${me}`]), "delete_activity", { tripId: `trip-${me}`, id: `act-${me}` });

    expect(result).toEqual({ isError: false, out: { deleted: { id: `act-${me}` } } });
    expect(row("activity", `act-${me}`)).toBeUndefined();
    expect(deletions(`grant-${me}`)).toEqual([
      expect.objectContaining({
        userId: me,
        tripId: `trip-${me}`,
        entityType: "Activity",
        entityId: `act-${me}`,
        snapshot: expect.objectContaining({
          id: `act-${me}`,
          tripId: `trip-${me}`,
          name: "Fushimi Inari",
          scheduledAt: new Date("2026-04-02T09:00:00").toISOString(),
        }),
      }),
    ]);
  });

  it("locks the connection's row before counting its deletions", async () => {
    await call(as(me, "all"), "delete_task", { tripId: `trip-${me}`, id: `task-${me}` });

    expect(dbCalls.slice(0, 2)).toEqual([
      `SELECT id FROM "AgentGrant" WHERE id = ? FOR UPDATE ${JSON.stringify([`grant-${me}`])}`,
      "count agentAuditEntry",
    ]);
  });

  it("the 21st deletion in 24 hours is refused and the element stays; older ones and other connections don't count (CA12)", async () => {
    pastDeletions(me, 5, 30);
    pastDeletions(other, 20, 2);
    pastDeletions(me, 19, 23);
    const context = as(me, "all");

    expect((await call(context, "delete_task", { tripId: `trip-${me}`, id: `task-${me}` })).isError).toBe(false);

    const before = fakeServiceDb.dump();
    const refused = await call(context, "delete_activity", { tripId: `trip-${me}`, id: `act-${me}` });
    expect(refused).toEqual({ isError: true, out: { code: "limit", retryAfterSeconds: expect.any(Number) } });
    // The oldest of the window is 23 hours old: it leaves it in about an hour.
    expect(refused.out.retryAfterSeconds).toBeGreaterThan(3500);
    expect(refused.out.retryAfterSeconds).toBeLessThanOrEqual(3600);
    expect(row("activity", `act-${me}`)).toBeDefined();
    expect(fakeServiceDb.dump()).toEqual(before);
  });

  it("refuses a site with dives, an area with sites and equipment with service or dives, saying what is linked (CA15)", async () => {
    const context = as(me, "all");
    row("diveLog", `dive-${me}`)!.diveSiteId = `site-${me}`;
    row("diveSite", `site-${me}`)!.diveAreaId = `area-${me}`;
    fakeServiceDb.rows("diveEquipment").push({ id: `eq-${me}-2`, userId: me, name: "Ordenador", status: "OWNED" });
    row("diveLog", `dive-${me}`)!.equipment = [{ id: `eq-${me}-2` }];
    const before = fakeServiceDb.dump();
    const conflict = (linked: Record<string, number>) => ({
      isError: true,
      out: { code: "conflict", message: "It has linked records; nothing was deleted", linked },
    });

    expect(await call(context, "delete_dive_site", { id: `site-${me}` })).toEqual(conflict({ dives: 1 }));
    expect(await call(context, "delete_dive_area", { id: `area-${me}` })).toEqual(conflict({ sites: 1 }));
    expect(await call(context, "delete_equipment", { id: `eq-${me}` })).toEqual(conflict({ services: 1 }));
    expect(await call(context, "delete_equipment", { id: `eq-${me}-2` })).toEqual(conflict({ dives: 1 }));
    expect(fakeServiceDb.dump()).toEqual(before);
  });

  it("deletes a site, an area, equipment, a service and a certification with nothing linked (CA15)", async () => {
    const context = as(me, "all");
    for (const [tool, id] of [
      ["delete_dive_site", `site-${me}`],
      ["delete_dive_area", `area-${me}`],
      ["delete_equipment_service", `svc-${me}`],
      ["delete_equipment", `eq-${me}`],
      ["delete_certification", `cert-${me}`],
    ] as const) {
      expect(await call(context, tool, { id }), tool).toEqual({ isError: false, out: { deleted: { id } } });
    }
    expect(deletions(`grant-${me}`).map((entry) => entry.entityType)).toEqual([
      "Dive site",
      "Dive area",
      "Equipment service",
      "Equipment",
      "Certification",
    ]);
    expect(deletions(`grant-${me}`)[0].snapshot).toMatchObject({ id: `site-${me}`, userId: me, name: "Bajo de Dentro" });
  });

  it("the other user's trip, element, site or equipment: the same not_found, and nothing changes (CA6)", async () => {
    const context = as(me, "all");
    const before = fakeServiceDb.dump();
    const notFound = (entity: string) => ({ isError: true, out: { code: "not_found", message: `${entity} not found` } });

    for (const [tool, id, entity] of [
      ["delete_destination", `dest-${other}`, "Destination"],
      ["delete_flight", `flight-${other}`, "Flight"],
      ["delete_accommodation", `acc-${other}`, "Accommodation"],
      ["delete_activity", `act-${other}`, "Activity"],
      ["delete_document", `doc-${other}`, "Document"],
      ["delete_expense", `exp-${other}`, "Expense"],
      ["delete_task", `task-${other}`, "Task"],
      ["delete_packing_item", `item-${other}`, "Packing item"],
    ] as const) {
      expect(await call(context, tool, { tripId: `trip-${me}`, id })).toEqual(notFound(entity));
      expect(await call(context, tool, { tripId: `trip-${other}`, id })).toEqual(notFound("Trip"));
      expect(await call(context, tool, { tripId: `trip-${me}`, id: "missing" })).toEqual(notFound(entity));
    }
    for (const [tool, id, entity] of [
      ["delete_dive_site", `site-${other}`, "Dive site"],
      ["delete_dive_area", `area-${other}`, "Dive area"],
      ["delete_equipment", `eq-${other}`, "Equipment"],
      ["delete_equipment_service", `svc-${other}`, "Equipment service"],
      ["delete_certification", `cert-${other}`, "Certification"],
    ] as const) {
      expect(await call(context, tool, { id })).toEqual(notFound(entity));
      expect(await call(context, tool, { id: "missing" })).toEqual(notFound(entity));
    }
    expect(fakeServiceDb.dump()).toEqual(before);
  });

  it("a trip outside the connection gives not_found and deletes nothing", async () => {
    const before = fakeServiceDb.dump();
    expect(await call(as(me, [`trip-${me}-2`]), "delete_activity", { tripId: `trip-${me}`, id: `act-${me}` })).toEqual({
      isError: true,
      out: { code: "not_found", message: "Trip not found" },
    });
    expect(fakeServiceDb.dump()).toEqual(before);
  });

  it("the web deletes as it always did: no lock, no count and no entry", async () => {
    pastDeletions(me, 20, 1);
    await deleteActivity(webActorOf(me), `trip-${me}`, `act-${me}`);
    expect(row("activity", `act-${me}`)).toBeUndefined();
    expect(dbCalls).toEqual([]);
    expect(deletions(`grant-${me}`)).toHaveLength(20);
  });
});
