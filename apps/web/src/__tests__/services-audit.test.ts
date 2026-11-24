import { describe, it, expect, vi, beforeEach } from "vitest";
import * as accommodations from "@/lib/services/accommodations";
import * as dives from "@/lib/services/dives";
import * as diveSites from "@/lib/services/dive-sites";
import * as expenses from "@/lib/services/expenses";
import * as packing from "@/lib/services/packing";
import * as tasks from "@/lib/services/tasks";
import * as trips from "@/lib/services/trips";
import { NotFoundError } from "@/lib/services/errors";
import { AUDIT_RETENTION_MS } from "@/lib/services/audit";
import { A, B, fakeServiceDb, seedTwoUsers } from "./helpers/fake-service-db";
import { agentActor, webActorOf } from "./helpers/actors";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers/fake-service-db")).fakeServicePrisma }));
vi.mock("@/lib/geocode-items", () => ({
  geocodeAccommodation: vi.fn(),
  geocodeActivity: vi.fn(),
  geocodeDiveSite: vi.fn(),
}));
vi.mock("@/lib/exchangeRate", () => ({ getExchangeRate: vi.fn(async () => 2) }));

beforeEach(() => {
  seedTwoUsers();
});

const entries = () => fakeServiceDb.rows("agentAuditEntry");
const row = (table: "accommodation" | "task" | "expense" | "packingItem" | "diveLog" | "diveSite", id: string) =>
  fakeServiceDb.rows(table).find((r) => r.id === id);

const hotel = { name: "Hotel Kioto", city: "Kioto", checkIn: "2026-04-01", checkOut: "2026-04-05" };

describe.each([A, B])("the register and the mark of %s's agent (CA20, CA21)", (me) => {
  const agent = agentActor(me, "all");

  it("a creation leaves its entry and the connection's mark", async () => {
    const created = await accommodations.createAccommodation(agent, `trip-${me}`, hotel);

    expect(row("accommodation", created.id)).toMatchObject({ agentGrantId: `grant-${me}` });
    expect(entries()).toEqual([
      expect.objectContaining({
        userId: me,
        grantId: `grant-${me}`,
        tripId: `trip-${me}`,
        entityType: "Accommodation",
        entityId: created.id,
        action: "CREATED",
      }),
    ]);
  });

  it("an edit keeps, of each field it changes, the value before and after, and nothing else", async () => {
    const created = await accommodations.createAccommodation(agent, `trip-${me}`, hotel);
    await accommodations.updateAccommodation(agent, `trip-${me}`, created.id, {
      name: "Hotel Gion",
      city: "Kioto",
      checkOut: "2026-04-06",
    });

    expect(entries()[1]).toMatchObject({
      action: "UPDATED",
      entityId: created.id,
      changes: { name: ["Hotel Kioto", "Hotel Gion"], checkOut: ["2026-04-05", "2026-04-06"] },
    });
    // The city didn't change and the cleared coordinates aren't the agent's edit.
    expect(Object.keys(entries()[1].changes as object).sort()).toEqual(["checkOut", "name"]);
  });

  it("a dive edit records the date and time it moves", async () => {
    await dives.updateDiveLog(agent, `dive-${me}`, { date: "2026-08-01", time: "10:30" });
    expect(entries()[0]).toMatchObject({
      entityType: "Dive",
      entityId: `dive-${me}`,
      tripId: null,
      changes: expect.objectContaining({ date: [expect.any(String), "2026-08-01T10:30"] }),
    });
  });

  it("a diving edit has no trip", async () => {
    await diveSites.updateDiveSite(agent, `site-${me}`, { name: "Bajo de Dentro" });
    expect(entries()[0]).toMatchObject({ entityType: "Dive site", entityId: `site-${me}`, tripId: null });
    expect(row("diveSite", `site-${me}`)).toMatchObject({ agentGrantId: `grant-${me}` });
  });

  it("an edit of the other user's element leaves no entry", async () => {
    const other = me === A ? B : A;
    await expect(
      accommodations.updateAccommodation(agent, `trip-${me}`, `acc-${other}`, { name: "x" }),
    ).rejects.toThrow(NotFoundError);
    expect(entries()).toEqual([]);
  });

  it("an edit from the web clears the mark and leaves no entry", async () => {
    const created = await accommodations.createAccommodation(agent, `trip-${me}`, hotel);
    await accommodations.updateAccommodation(webActorOf(me), `trip-${me}`, created.id, { notes: "Con desayuno" });

    expect(row("accommodation", created.id)).toMatchObject({ agentGrantId: null, notes: "Con desayuno" });
    expect(entries()).toHaveLength(1);
  });

  it("the web's switches clear the mark too", async () => {
    const task = await tasks.createTask(agent, `trip-${me}`, { title: "Comprar yenes" });
    const expense = await expenses.createExpense(agent, `trip-${me}`, {
      category: "FOOD",
      description: "Ramen",
      amount: 12,
      date: "2026-04-02",
    });
    const item = await packing.createPackingItem(agent, `trip-${me}`, { name: "Adaptador", category: "Electrónica" });
    const web = webActorOf(me);

    await tasks.toggleTaskDone(web, `trip-${me}`, task.id, true);
    await expenses.toggleExpensePaid(web, `trip-${me}`, expense.id, true);
    await packing.togglePackingItem(web, `trip-${me}`, item.id, true);

    expect(row("task", task.id)).toMatchObject({ done: true, agentGrantId: null });
    expect(row("expense", expense.id)).toMatchObject({ paid: true, agentGrantId: null });
    expect(row("packingItem", item.id)).toMatchObject({ packed: true, agentGrantId: null });
  });

  it("creating from the web leaves no mark", async () => {
    const created = await trips.createTrip(webActorOf(me), { name: "Japón", startDate: "2026-04-01", endDate: "2026-04-10" });
    expect(created).toMatchObject({ agentGrantId: null });
    expect(entries()).toEqual([]);
  });

  it("each write drops the user's entries older than 90 days, and only theirs", async () => {
    const other = me === A ? B : A;
    const old = new Date(Date.now() - AUDIT_RETENTION_MS - 60_000);
    const recent = new Date(Date.now() - AUDIT_RETENTION_MS + 60_000);
    fakeServiceDb.rows("agentAuditEntry").push(
      { ...entryRow(me, "old"), createdAt: old },
      { ...entryRow(me, "recent"), createdAt: recent },
      { ...entryRow(other, "old-other"), createdAt: old },
    );

    await tasks.createTask(agent, `trip-${me}`, { title: "Reservar ryokan" });

    expect(entries().map((entry) => entry.id).sort()).toEqual([
      expect.stringMatching(/^entry-new-/),
      "old-other",
      "recent",
    ]);
  });
});

function entryRow(userId: string, id: string) {
  return {
    id,
    userId,
    grantId: `grant-${userId}`,
    tripId: null,
    entityType: "Task",
    entityId: "task",
    action: "CREATED",
    changes: null,
    snapshot: null,
    restoredAt: null,
  };
}
