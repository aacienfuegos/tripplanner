// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { geocodeAccommodation } from "@/lib/geocode-items";
import { TOOLS } from "@/lib/mcp/tools";
import { A, B, fakeServiceDb } from "./helpers/fake-service-db";
import { agentActor } from "./helpers/actors";
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

const as = (user: string, trips: readonly string[] | "all") => ({ actor: agentActor(user, trips), mediaAdmin: false });
const rows = (table: Parameters<typeof fakeServiceDb.rows>[0], tripId: string) =>
  fakeServiceDb.rows(table).filter((row) => row.tripId === tripId);
const hotel = { name: "Hotel Kioto Station", city: "Kioto", checkIn: "2026-04-03", checkOut: "2026-04-05" };

describe.each([
  [A, B],
  [B, A],
])("the trips of %s's connection, with the ids of %s", (me, other) => {
  it("a connection to one trip lists only that one, and gets it with its sections and its dives (CA5)", async () => {
    const context = as(me, [`trip-${me}`]);
    const listed = await call(context, "list_trips", {});
    expect((listed.out.items as { id: string }[]).map((trip) => trip.id)).toEqual([`trip-${me}`]);
    expect(listed.out.nextCursor).toBeNull();

    fakeServiceDb.rows("diveLog").find((dive) => dive.id === `dive-${me}`)!.tripId = `trip-${me}`;
    const { out } = await call(context, "get_trip", { tripId: `trip-${me}` });
    expect(out.trip).toMatchObject({ id: `trip-${me}`, startDate: "2026-04-01" });
    expect(out.accommodations).toEqual([expect.objectContaining({ id: `acc-${me}`, checkIn: "2026-04-01" })]);
    expect(out.flights).toEqual([expect.objectContaining({ id: `flight-${me}`, departureAt: "2026-04-01T10:00" })]);
    expect(out.dives).toEqual([expect.objectContaining({ id: `dive-${me}`, date: "2026-03-01", time: "10:00" })]);
    expect(out.truncated).toEqual([]);

    expect(await call(context, "get_trip", { tripId: `trip-${me}-2` })).toEqual({
      isError: true,
      out: { code: "not_found", message: "Trip not found" },
    });
  });

  it("all trips lists only the user's, page by page", async () => {
    const first = await call(as(me, "all"), "list_trips", { limit: 1 });
    expect((first.out.items as { id: string }[]).map((trip) => trip.id)).toEqual([`trip-${me}`]);
    const second = await call(as(me, "all"), "list_trips", { limit: 1, cursor: first.out.nextCursor });
    expect((second.out.items as { id: string }[]).map((trip) => trip.id)).toEqual([`trip-${me}-2`]);
    expect(second.out.nextCursor).toBeNull();
  });

  it("the other user's trip, element or id that doesn't exist: the same not_found, and nothing changes (CA6)", async () => {
    const context = as(me, "all");
    const before = fakeServiceDb.dump();
    const notFound = (entity: string) => ({ isError: true, out: { code: "not_found", message: `${entity} not found` } });

    expect(await call(context, "get_trip", { tripId: `trip-${other}` })).toEqual(notFound("Trip"));
    expect(await call(context, "get_trip", { tripId: "trip-missing" })).toEqual(notFound("Trip"));
    expect(await call(context, "update_trip", { tripId: `trip-${other}`, name: "Mío" })).toEqual(notFound("Trip"));
    expect(await call(context, "create_accommodation", { tripId: `trip-${other}`, ...hotel })).toEqual(notFound("Trip"));
    for (const [tool, id, entity] of [
      ["update_accommodation", `acc-${other}`, "Accommodation"],
      ["update_destination", `dest-${other}`, "Destination"],
      ["update_flight", `flight-${other}`, "Flight"],
      ["update_activity", `act-${other}`, "Activity"],
      ["update_document", `doc-${other}`, "Document"],
      ["update_expense", `exp-${other}`, "Expense"],
      ["update_task", `task-${other}`, "Task"],
      ["update_packing_item", `item-${other}`, "Packing item"],
    ] as const) {
      expect(await call(context, tool, { tripId: `trip-${me}`, id, notes: "x", name: "x" })).toEqual(notFound(entity));
      expect(await call(context, tool, { tripId: `trip-${other}`, id, notes: "x", name: "x" })).toEqual(notFound("Trip"));
      expect(await call(context, tool, { tripId: `trip-${me}`, id: "missing", notes: "x", name: "x" })).toEqual(
        notFound(entity),
      );
    }
    expect(fakeServiceDb.dump()).toEqual(before);
  });

  it("an accommodation it creates has the mark and goes to the map; its edit is in the register (CA7)", async () => {
    const context = as(me, [`trip-${me}`]);
    const created = await call(context, "create_accommodation", { tripId: `trip-${me}`, ...hotel });
    expect(created.isError).toBe(false);
    const id = (created.out.accommodation as { id: string }).id;
    expect(fakeServiceDb.rows("accommodation").find((row) => row.id === id)).toMatchObject({ agentGrantId: `grant-${me}` });
    expect(geocodeAccommodation).toHaveBeenCalledWith(id);

    const updated = await call(context, "update_accommodation", { tripId: `trip-${me}`, id, checkOut: "2026-04-06" });
    expect(updated.out.accommodation).toMatchObject({ id, checkOut: "2026-04-06", name: hotel.name });
    expect(fakeServiceDb.rows("agentAuditEntry").at(-1)).toMatchObject({
      action: "UPDATED",
      entityId: id,
      changes: { checkOut: ["2026-04-05", "2026-04-06"] },
    });
  });

  it("a document keeps its type, title, link, expiry and notes; a javascript: link is refused with its field (CA8)", async () => {
    const context = as(me, [`trip-${me}`]);
    const document = {
      tripId: `trip-${me}`,
      type: "INSURANCE",
      name: "Seguro de viaje",
      fileUrl: "https://example.com/poliza.pdf",
      expiresAt: "2026-12-31",
      notes: "<b>Llamar</b> antes",
    };
    const created = await call(context, "create_document", document);
    expect(created.out.document).toMatchObject({ ...document, tripId: `trip-${me}` });

    const before = fakeServiceDb.dump();
    expect(await call(context, "create_document", { ...document, name: "Otro", fileUrl: "javascript:alert(1)" })).toEqual({
      isError: true,
      out: { code: "invalid_input", field: "fileUrl", message: "The URL must use http or https" },
    });
    expect(fakeServiceDb.dump()).toEqual(before);
  });

  it("the same accommodation again isn't created and gives the existing one; with force it is (CA9)", async () => {
    const context = as(me, [`trip-${me}`]);
    const again = { tripId: `trip-${me}`, name: "Gion Hotel", city: "Kioto", checkIn: "2026-04-01", checkOut: "2026-04-03" };

    const refused = await call(context, "create_accommodation", again);
    expect(refused).toEqual({ isError: true, out: { code: "duplicate", existing: expect.objectContaining({ id: `acc-${me}` }) } });
    expect(rows("accommodation", `trip-${me}`)).toHaveLength(1);

    expect((await call(context, "create_accommodation", { ...again, force: true })).isError).toBe(false);
    expect(rows("accommodation", `trip-${me}`)).toHaveLength(2);
  });

  it("creating or editing a trip needs all trips; there is no tool to delete one (CA13)", async () => {
    const trip = { name: "Islandia", startDate: "2027-01-10", endDate: "2027-01-20" };
    const forbidden = { isError: true, out: { code: "forbidden", message: "Not allowed for this connection" } };
    expect(await call(as(me, [`trip-${me}`]), "create_trip", trip)).toEqual(forbidden);
    expect(await call(as(me, [`trip-${me}`]), "update_trip", { tripId: `trip-${me}`, name: "Japón" })).toEqual(forbidden);

    const created = await call(as(me, "all"), "create_trip", trip);
    expect(created.out.trip).toMatchObject({ name: "Islandia", startDate: "2027-01-10" });
    const updated = await call(as(me, "all"), "update_trip", { tripId: `trip-${me}`, name: "Japón y Corea" });
    expect(updated.out.trip).toMatchObject({ id: `trip-${me}`, name: "Japón y Corea" });

    expect(TOOLS.some((tool) => tool.name === "delete_trip" || tool.name === "delete_dive")).toBe(false);
  });

  it("a note with HTML is stored as the text it is (CA22)", async () => {
    const created = await call(as(me, "all"), "create_task", {
      tripId: `trip-${me}`,
      title: "Revisar",
      notes: '<img src=x onerror="alert(1)">',
    });
    expect(created.out.task).toMatchObject({ notes: '<img src=x onerror="alert(1)">' });
  });
});
