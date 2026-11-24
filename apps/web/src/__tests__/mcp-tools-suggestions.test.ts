// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { geocodeAccommodation, geocodeActivity } from "@/lib/geocode-items";
import {
  PENDING_LIMIT,
  PENDING_SHOWN,
  acceptSuggestion,
  dismissSuggestion,
  listPendingSuggestions,
} from "@/lib/services/suggestions";
import { getAgentLabels } from "@/lib/agent-labels";
import { NotFoundError } from "@/lib/services/errors";
import { A, B, dbCalls, fakeServiceDb, fakeServicePrisma } from "./helpers/fake-service-db";
import { agentActor, webActorOf } from "./helpers/actors";
import { call, seedForTools } from "./helpers/mcp-tools";

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

const as = (user: string, trips: readonly string[] | "all") => ({ actor: agentActor(user, trips), mediaAdmin: false });
const hotel = { name: "Ryokan Kurashiki", city: "Kurashiki", checkIn: "2026-04-05", checkOut: "2026-04-06", price: 180 };
const dinner = { name: "Cena en Pontocho", city: "Kioto", scheduledAt: "2026-04-03T20:00" };
const suggestion = (id: string) => fakeServiceDb.rows("agentSuggestion").find((s) => s.id === id);
const inTrip = (table: "accommodation" | "activity" | "expense", tripId: string) =>
  fakeServiceDb.rows(table).filter((row) => row.tripId === tripId);

async function suggested(user: string, tool: string, args: Record<string, unknown>, trips: readonly string[] | "all" = "all") {
  const result = await call(as(user, trips), tool, { tripId: `trip-${user}`, ...args });
  expect(result.isError, JSON.stringify(result.out)).toBe(false);
  return (result.out.suggestion as { id: string }).id;
}

// Suggestions already stored, one minute apart from the start of 2026.
let storedCount = 0;
function stored(user: string, n: number, rest: Record<string, unknown> = {}) {
  const rows = Array.from({ length: n }, (_, i) => ({
    id: `stored-${user}-${++storedCount}`,
    tripId: `trip-${user}`,
    grantId: `grant-${user}`,
    kind: "ACTIVITY",
    payload: dinner,
    status: "PENDING",
    createdAt: new Date(2026, 0, 1, 0, i),
    resolvedAt: null,
    resultId: null,
    ...rest,
  }));
  fakeServiceDb.rows("agentSuggestion").push(...rows);
  return rows.map((row) => row.id);
}

async function expectNotFound(run: Promise<unknown>, entity: string) {
  const before = fakeServiceDb.dump();
  await expect(run).rejects.toThrow(NotFoundError);
  await run.catch((error: NotFoundError) => expect(error.entity).toBe(entity));
  expect(fakeServiceDb.dump()).toEqual(before);
}

describe.each([
  [A, B],
  [B, A],
])("suggestions of %s's agent, with the ids of %s", (me, other) => {
  it("a suggestion waits apart: not among the trip's accommodations, activities or expenses, nor on the map (CA19)", async () => {
    const accommodations = inTrip("accommodation", `trip-${me}`).length;
    const activities = inTrip("activity", `trip-${me}`).length;
    const expenses = inTrip("expense", `trip-${me}`).length;

    const id = await suggested(me, "suggest_accommodation", hotel);
    await suggested(me, "suggest_activity", dinner);

    expect(suggestion(id)).toMatchObject({ tripId: `trip-${me}`, grantId: `grant-${me}`, kind: "ACCOMMODATION", status: "PENDING", payload: hotel });
    expect(inTrip("accommodation", `trip-${me}`)).toHaveLength(accommodations);
    expect(inTrip("activity", `trip-${me}`)).toHaveLength(activities);
    expect(inTrip("expense", `trip-${me}`)).toHaveLength(expenses);
    expect(geocodeAccommodation).not.toHaveBeenCalled();
    const { out } = await call(as(me, "all"), "get_trip", { tripId: `trip-${me}` });
    expect((out.accommodations as unknown[]).length).toBe(accommodations);
    // And it is in the register as a suggestion (CA20).
    expect(fakeServiceDb.rows("agentAuditEntry")).toEqual([
      expect.objectContaining({ userId: me, action: "SUGGESTED", entityType: "Accommodation", entityId: id }),
      expect.objectContaining({ userId: me, action: "SUGGESTED", entityType: "Activity" }),
    ]);
  });

  it("is validated like creating one: a javascript: link or a missing field is refused, and nothing is stored", async () => {
    const before = fakeServiceDb.dump();
    expect(
      await call(as(me, "all"), "suggest_accommodation", { tripId: `trip-${me}`, ...hotel, confirmationUrl: "javascript:alert(1)" }),
    ).toEqual({ isError: true, out: { code: "invalid_input", field: "confirmationUrl", message: "The URL must use http or https" } });
    expect((await call(as(me, "all"), "suggest_activity", { tripId: `trip-${me}`, city: "Kioto" })).out).toMatchObject({
      code: "invalid_input",
      field: "name",
    });
    expect(fakeServiceDb.dump()).toEqual(before);
  });

  it("can't suggest in the other user's trip or a trip outside the connection", async () => {
    const before = fakeServiceDb.dump();
    const notFound = { isError: true, out: { code: "not_found", message: "Trip not found" } };
    expect(await call(as(me, "all"), "suggest_accommodation", { ...hotel, tripId: `trip-${other}` })).toEqual(notFound);
    expect(await call(as(me, [`trip-${me}`]), "suggest_activity", { ...dinner, tripId: `trip-${me}-2` })).toEqual(notFound);
    expect(fakeServiceDb.dump()).toEqual(before);
  });

  it("accepting makes it a normal accommodation with the mark that goes to the map; dismissing another hides it; the agent sees both (CA19)", async () => {
    fakeServiceDb.rows("agentGrant").push({ id: `grant-${me}`, userId: me, name: `Agente de ${me}` });
    const kept = await suggested(me, "suggest_accommodation", hotel);
    const dropped = await suggested(me, "suggest_activity", dinner);

    await acceptSuggestion(webActorOf(me), `trip-${me}`, kept);
    await dismissSuggestion(webActorOf(me), `trip-${me}`, dropped);

    expect(fakeServiceDb.rows("accommodation").find((row) => row.id === kept)).toMatchObject({
      tripId: `trip-${me}`,
      name: hotel.name,
      price: 180,
      checkIn: new Date(hotel.checkIn),
      agentGrantId: `grant-${me}`,
    });
    expect(geocodeAccommodation).toHaveBeenCalledWith(kept);
    expect(geocodeActivity).not.toHaveBeenCalled();
    expect(inTrip("activity", `trip-${me}`).some((row) => row.id === dropped)).toBe(false);
    expect(await getAgentLabels(me, [{ id: kept, agentGrantId: `grant-${me}` }])).toEqual({
      [kept]: { name: `Agente de ${me}`, added: true },
    });
    expect(await listPendingSuggestions(me, `trip-${me}`, "ACCOMMODATION")).toEqual({ suggestions: [], more: false });

    const listed = await call(as(me, "all"), "list_suggestions", {});
    expect(listed.out.nextCursor).toBeNull();
    expect(listed.out.items).toHaveLength(2);
    expect(listed.out.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: kept, status: "ACCEPTED", resultId: kept, resolvedAt: expect.any(String) }),
        expect.objectContaining({ id: dropped, status: "DISMISSED", resultId: null, resolvedAt: expect.any(String) }),
      ]),
    );
  });

  it("accepting the same one twice creates one accommodation", async () => {
    const id = await suggested(me, "suggest_accommodation", hotel);
    await acceptSuggestion(webActorOf(me), `trip-${me}`, id);

    await expectNotFound(acceptSuggestion(webActorOf(me), `trip-${me}`, id), "Suggestion");
    await expectNotFound(dismissSuggestion(webActorOf(me), `trip-${me}`, id), "Suggestion");
    expect(fakeServiceDb.rows("accommodation").filter((row) => row.id === id)).toHaveLength(1);
  });

  it("if another request accepts it first, nothing is created", async () => {
    const id = await suggested(me, "suggest_accommodation", hotel);
    const claim = vi.spyOn(fakeServicePrisma.agentSuggestion, "updateMany").mockResolvedValueOnce({ count: 0 });

    await expectNotFound(acceptSuggestion(webActorOf(me), `trip-${me}`, id), "Suggestion");
    expect(claim).toHaveBeenCalledWith({
      where: { id, tripId: `trip-${me}`, status: "PENDING", trip: { userId: me } },
      data: expect.objectContaining({ status: "ACCEPTED" }),
    });
    expect(fakeServiceDb.rows("accommodation").some((row) => row.id === id)).toBe(false);
  });

  it("the other user's suggestion can't be accepted or dismissed, by its trip or by one's own (Filtros de propiedad)", async () => {
    const theirs = await suggested(other, "suggest_accommodation", hotel);
    const dismiss = vi.spyOn(fakeServicePrisma.agentSuggestion, "updateMany");

    await expectNotFound(acceptSuggestion(webActorOf(me), `trip-${other}`, theirs), "Trip");
    await expectNotFound(dismissSuggestion(webActorOf(me), `trip-${other}`, theirs), "Trip");
    await expectNotFound(acceptSuggestion(webActorOf(me), `trip-${me}`, theirs), "Suggestion");
    await expectNotFound(dismissSuggestion(webActorOf(me), `trip-${me}`, theirs), "Suggestion");
    expect(dismiss).toHaveBeenCalledWith({
      where: { id: theirs, tripId: `trip-${me}`, status: "PENDING", trip: { userId: me } },
      data: expect.objectContaining({ status: "DISMISSED" }),
    });
    expect(suggestion(theirs)).toMatchObject({ status: "PENDING" });
  });

  it("locks the connection's row before counting its pending suggestions", async () => {
    await suggested(me, "suggest_activity", dinner);

    expect(dbCalls.slice(0, 2)).toEqual([
      `SELECT id FROM "AgentGrant" WHERE id = ? FOR UPDATE ${JSON.stringify([`grant-${me}`])}`,
      "count agentSuggestion",
    ]);
  });

  it(`the ${PENDING_LIMIT + 1}st pending one of a connection in a trip is refused; resolved ones, other trips and other connections don't count`, async () => {
    const mine = stored(me, PENDING_LIMIT - 1);
    stored(me, 5, { status: "DISMISSED", resolvedAt: new Date() });
    stored(me, 5, { tripId: `trip-${me}-2` });
    stored(me, 5, { grantId: `grant-${me}-other` });
    await suggested(me, "suggest_activity", dinner);

    const before = fakeServiceDb.dump();
    expect(await call(as(me, "all"), "suggest_accommodation", { tripId: `trip-${me}`, ...hotel })).toEqual({
      isError: true,
      out: { code: "limit", message: "Too many pending suggestions in this trip; nothing was suggested" },
    });
    expect(fakeServiceDb.dump()).toEqual(before);

    // Another trip still has room, and resolving one makes room again.
    await suggested(me, "suggest_activity", { tripId: `trip-${me}-2`, ...dinner });
    await dismissSuggestion(webActorOf(me), `trip-${me}`, mine[0]);
    await suggested(me, "suggest_accommodation", hotel);
  });

  it("suggesting drops the user's suggestions resolved more than 90 days ago, and nothing else", async () => {
    const ago = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const old = stored(me, 2, { status: "ACCEPTED", resolvedAt: ago(91) });
    const oldOtherTrip = stored(me, 1, { tripId: `trip-${me}-2`, status: "DISMISSED", resolvedAt: ago(91) });
    const recent = stored(me, 1, { status: "DISMISSED", resolvedAt: ago(89) });
    const pending = stored(me, 1, { createdAt: ago(200) });
    const theirs = stored(other, 1, { status: "DISMISSED", resolvedAt: ago(91) });

    await suggested(me, "suggest_activity", dinner);

    const ids = fakeServiceDb.rows("agentSuggestion").map((row) => row.id);
    for (const id of [...old, ...oldOtherTrip]) expect(ids).not.toContain(id);
    for (const id of [...recent, ...pending, ...theirs]) expect(ids).toContain(id);
  });

  it(`the trip's page gets the ${PENDING_SHOWN} oldest pending ones and knows there are more`, async () => {
    const ids = stored(me, PENDING_SHOWN + 1);
    stored(other, 3);

    const { suggestions, more } = await listPendingSuggestions(me, `trip-${me}`, "ACTIVITY");
    expect(suggestions.map((s) => s.id)).toEqual(ids.slice(0, PENDING_SHOWN));
    expect(more).toBe(true);

    await dismissSuggestion(webActorOf(me), `trip-${me}`, ids[0]);
    expect(await listPendingSuggestions(me, `trip-${me}`, "ACTIVITY")).toMatchObject({ more: false });
    expect(await listPendingSuggestions(me, `trip-${me}`, "ACCOMMODATION")).toEqual({ suggestions: [], more: false });
  });

  it("list_suggestions gives only the connection's, in the trips it reaches and of its user (Filtros de propiedad)", async () => {
    const mine = await suggested(me, "suggest_accommodation", hotel);
    const outside = (
      await call(as(me, "all"), "suggest_activity", { ...dinner, tripId: `trip-${me}-2`, scheduledAt: "2026-07-03T20:00" })
    ).out.suggestion as { id: string };
    await suggested(other, "suggest_accommodation", hotel);
    // A row of the other user's trip carrying this connection's id still isn't listed.
    fakeServiceDb.rows("agentSuggestion").push({
      id: "forged",
      tripId: `trip-${other}`,
      grantId: `grant-${me}`,
      kind: "ACCOMMODATION",
      payload: hotel,
      status: "PENDING",
      createdAt: new Date(),
      resolvedAt: null,
      resultId: null,
    });

    const ids = async (trips: readonly string[] | "all", args: Record<string, unknown> = {}) =>
      ((await call(as(me, trips), "list_suggestions", args)).out.items as { id: string }[]).map((s) => s.id);

    expect(await ids("all")).toContain(outside.id);
    expect(await ids("all")).not.toContain("forged");
    expect(await ids([`trip-${me}`])).toContain(mine);
    expect(await ids([`trip-${me}`])).not.toContain(outside.id);
    expect(await ids("all", { tripId: `trip-${me}-2` })).toEqual([outside.id]);
    expect(await call(as(me, [`trip-${me}`]), "list_suggestions", { tripId: `trip-${me}-2` })).toEqual({
      isError: true,
      out: { code: "not_found", message: "Trip not found" },
    });
    expect(new Set(await ids("all"))).toEqual(new Set([mine, outside.id]));
  });
});
