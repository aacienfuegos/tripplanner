import { describe, it, expect, vi, beforeEach } from "vitest";
import { geocodeAccommodation, geocodeActivity } from "@/lib/geocode-items";
import * as accommodations from "@/lib/services/accommodations";
import * as activities from "@/lib/services/activities";
import * as destinations from "@/lib/services/destinations";
import * as documents from "@/lib/services/documents";
import * as expenses from "@/lib/services/expenses";
import * as flights from "@/lib/services/flights";
import * as packing from "@/lib/services/packing";
import * as tasks from "@/lib/services/tasks";
import * as trips from "@/lib/services/trips";
import type { Actor } from "@/lib/services/actor";
import { InputError, NotFoundError } from "@/lib/services/errors";
import { A, B, fakeServiceDb, seedTwoUsers } from "./helpers/fake-service-db";
import { agentActor, webActorOf } from "./helpers/actors";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers/fake-service-db")).fakeServicePrisma }));
vi.mock("@/lib/geocode-items", () => ({ geocodeAccommodation: vi.fn(), geocodeActivity: vi.fn() }));
vi.mock("@/lib/exchangeRate", () => ({ getExchangeRate: vi.fn(async () => 2) }));

beforeEach(() => {
  vi.clearAllMocks();
  seedTwoUsers();
});

async function expectNotFoundWithoutWrite(run: () => Promise<unknown>) {
  const before = fakeServiceDb.dump();
  await expect(run()).rejects.toThrow(NotFoundError);
  expect(fakeServiceDb.dump()).toEqual(before);
}

// The edits and deletes of every section, each with the id of an element.
type Write = (tripId: string, id: string, actor: Actor) => Promise<unknown>;
const writes: readonly (readonly [string, Write])[] = [
  ["dest", (t, id, actor) => destinations.updateDestination(actor, t, id, { notes: "x" })],
  ["dest", (t, id, actor) => destinations.deleteDestination(actor, t, id)],
  ["flight", (t, id, actor) => flights.updateFlight(actor, t, id, { notes: "x" })],
  ["flight", (t, id, actor) => flights.deleteFlight(actor, t, id)],
  ["acc", (t, id, actor) => accommodations.updateAccommodation(actor, t, id, { notes: "x" })],
  ["acc", (t, id, actor) => accommodations.deleteAccommodation(actor, t, id)],
  ["act", (t, id, actor) => activities.updateActivity(actor, t, id, { notes: "x" })],
  ["act", (t, id, actor) => activities.updateActivityStatus(actor, t, id, "CONFIRMED")],
  ["act", (t, id, actor) => activities.deleteActivity(actor, t, id)],
  ["doc", (t, id, actor) => documents.updateDocument(actor, t, id, { notes: "x" })],
  ["doc", (t, id, actor) => documents.deleteDocument(actor, t, id)],
  ["exp", (t, id, actor) => expenses.updateExpense(actor, t, id, { notes: "x" })],
  ["exp", (t, id, actor) => expenses.updateExpense(actor, t, id, { amount: 5 })],
  ["exp", (t, id, actor) => expenses.toggleExpensePaid(actor, t, id, true)],
  ["exp", (t, id, actor) => expenses.deleteExpense(actor, t, id)],
  ["task", (t, id, actor) => tasks.updateTask(actor, t, id, { notes: "x" })],
  ["task", (t, id, actor) => tasks.toggleTaskDone(actor, t, id, true)],
  ["task", (t, id, actor) => tasks.deleteTask(actor, t, id)],
  ["item", (t, id, actor) => packing.updatePackingItem(actor, t, id, { name: "x" })],
  ["item", (t, id, actor) => packing.togglePackingItem(actor, t, id, false)],
  ["item", (t, id, actor) => packing.deletePackingItem(actor, t, id)],
];

describe.each([
  [A, B],
  [B, A],
])("as an agent of %s, with the ids of %s (CA6)", (me, other) => {
  it("can't edit or delete an element of the other user's trip, by its id or through its own trip", async () => {
    const actor = agentActor(me, "all");
    for (const [prefix, write] of writes) {
      await expectNotFoundWithoutWrite(() => write(`trip-${other}`, `${prefix}-${other}`, actor));
      await expectNotFoundWithoutWrite(() => write(`trip-${me}`, `${prefix}-${other}`, actor));
      await expectNotFoundWithoutWrite(() => write(`trip-${me}`, `${prefix}-missing`, actor));
    }
  });

  it("can't create in the other user's trip nor edit it", async () => {
    const actor = agentActor(me, "all");
    await expectNotFoundWithoutWrite(() => tasks.createTask(actor, `trip-${other}`, { title: "Comprar yenes" }));
    await expectNotFoundWithoutWrite(() => trips.updateTrip(actor, `trip-${other}`, { name: "Mío" }));
  });

  it("can't reach a trip of its own user outside its connection", async () => {
    const actor = agentActor(me, [`trip-${me}`]);
    await expectNotFoundWithoutWrite(() => tasks.createTask(actor, `trip-${me}-2`, { title: "Comprar yenes" }));
    await expect(tasks.createTask(actor, `trip-${me}`, { title: "Comprar yenes" })).resolves.toMatchObject({
      tripId: `trip-${me}`,
    });
  });

  it("edits its own elements", async () => {
    const actor = agentActor(me, "all");
    for (const [prefix, write] of writes) {
      seedTwoUsers();
      await expect(write(`trip-${me}`, `${prefix}-${me}`, actor)).resolves.toBeUndefined();
    }
  });
});

describe("documents (CA8)", () => {
  it("an agent creates a document with type, title, link, expiry and notes, stored as the web stores it but for the mark", async () => {
    const input = {
      type: "VISA" as const,
      name: "Visado Japón",
      fileUrl: "https://example.com/visa.pdf",
      expiresAt: "2027-01-31",
      notes: "Original en la carpeta",
    };

    const byAgent = await documents.createDocument(agentActor(A, "all"), `trip-${A}`, input);
    const byWeb = await documents.createDocument(webActorOf(A), `trip-${A}`, input);

    const { id: agentId, ...agentRow } = byAgent;
    const { id: webId, ...webRow } = byWeb;
    expect(agentId).not.toBe(webId);
    expect(agentRow).toEqual({ ...webRow, agentGrantId: `grant-${A}` });
    expect(webRow).toMatchObject({ agentGrantId: null });
    expect(agentRow).toMatchObject({ tripId: `trip-${A}`, fileUrl: input.fileUrl, expiresAt: new Date("2027-01-31") });
  });

  it("rejects a javascript: link with the field and writes nothing", async () => {
    const before = fakeServiceDb.dump();
    const run = documents.createDocument(agentActor(A, "all"), `trip-${A}`, {
      type: "VISA",
      name: "Visado",
      fileUrl: "javascript:alert(1)",
    });

    await expect(run).rejects.toThrow(InputError);
    await expect(run).rejects.toMatchObject({ field: "fileUrl" });
    expect(fakeServiceDb.dump()).toEqual(before);
  });
});

describe("partial edits", () => {
  it("only touches the fields that come in the edit", async () => {
    await flights.createFlight(webActorOf(A), `trip-${A}`, {
      airline: "Iberia",
      flightNumber: "IB6800",
      origin: "MAD",
      destination: "NRT",
      departureAt: "2026-06-07T12:30",
      arrivalAt: "2026-06-08T09:10",
      seatNumber: "12A",
    });
    const flight = fakeServiceDb.rows("flight").find((f) => f.flightNumber === "IB6800");

    await flights.updateFlight(agentActor(A, "all"), `trip-${A}`, flight?.id as string, { notes: "Ventanilla" });

    expect(fakeServiceDb.rows("flight").find((f) => f.id === flight?.id)).toEqual({
      ...flight,
      notes: "Ventanilla",
      agentGrantId: `grant-${A}`,
    });
  });
});

describe("effects", () => {
  it("geocodes an accommodation when it is created, and clears and geocodes again when it is edited", async () => {
    const created = await accommodations.createAccommodation(webActorOf(A), `trip-${A}`, {
      name: "Hotel Gracery",
      city: "Tokio",
      checkIn: "2026-06-07",
      checkOut: "2026-06-10",
    });
    expect(geocodeAccommodation).toHaveBeenCalledWith(created.id);

    fakeServiceDb.rows("accommodation").find((a) => a.id === created.id)!.latitude = 35.69;
    await accommodations.updateAccommodation(agentActor(A, "all"), `trip-${A}`, created.id, { address: "Kabukicho 1-19-1" });

    expect(fakeServiceDb.rows("accommodation").find((a) => a.id === created.id)).toMatchObject({
      address: "Kabukicho 1-19-1",
      latitude: null,
      longitude: null,
    });
    expect(geocodeAccommodation).toHaveBeenCalledTimes(2);
  });

  it("geocodes an activity when it is created and when it is edited", async () => {
    const created = await activities.createActivity(agentActor(A, "all"), `trip-${A}`, { name: "Senso-ji", city: "Tokio" });
    await activities.updateActivity(webActorOf(A), `trip-${A}`, created.id, { location: "Asakusa" });

    expect(geocodeActivity).toHaveBeenNthCalledWith(1, created.id);
    expect(geocodeActivity).toHaveBeenNthCalledWith(2, created.id);
  });

  it("converts an expense to the trip's currency, and an edit of the amount alone uses the stored currency", async () => {
    const created = await expenses.createExpense(agentActor(A, "all"), `trip-${A}`, {
      category: "FOOD",
      description: "Ramen",
      amount: 10,
      currency: "USD",
      date: "2026-06-08",
    });
    expect(created).toMatchObject({ amount: 10, currency: "USD", exchangeRate: 2, convertedAmount: 20 });

    await expenses.updateExpense(agentActor(A, "all"), `trip-${A}`, created.id, { amount: 15 });
    expect(fakeServiceDb.rows("expense").find((e) => e.id === created.id)).toMatchObject({
      amount: 15,
      currency: "USD",
      convertedAmount: 30,
    });

    await expenses.updateExpense(agentActor(A, "all"), `trip-${A}`, created.id, { currency: "EUR" });
    expect(fakeServiceDb.rows("expense").find((e) => e.id === created.id)).toMatchObject({
      amount: 15,
      currency: "EUR",
      exchangeRate: null,
      convertedAmount: null,
    });
  });

  it("recalculates the trip's expenses when an agent changes its currency", async () => {
    await trips.updateTrip(agentActor(A, "all"), `trip-${A}`, { currency: "USD" });

    expect(fakeServiceDb.rows("expense").find((e) => e.id === `exp-${A}`)).toMatchObject({ exchangeRate: 2, convertedAmount: 20 });
    expect(fakeServiceDb.rows("expense").find((e) => e.id === `exp-${B}`)).not.toHaveProperty("convertedAmount");
  });

  it("reorders the destinations by arrival date after an agent's edit", async () => {
    const later = await destinations.createDestination(agentActor(A, "all"), `trip-${A}`, {
      city: "Osaka",
      country: "JP",
      arrivalDate: "2026-06-12",
      departureDate: "2026-06-14",
    });
    const earlier = await destinations.createDestination(agentActor(A, "all"), `trip-${A}`, {
      city: "Tokio",
      country: "JP",
      arrivalDate: "2026-06-07",
      departureDate: "2026-06-12",
    });

    await destinations.updateDestination(agentActor(A, "all"), `trip-${A}`, later.id, { arrivalDate: "2026-06-01" });

    const order = (id: string) => fakeServiceDb.rows("destination").find((d) => d.id === id)?.order;
    expect(order(later.id)).toBeLessThan(order(earlier.id) as number);
  });
});

describe("packing with an agent", () => {
  it("creates the item with no bag, whatever bag comes with it", async () => {
    const created = await packing.createPackingItem(agentActor(A, "all"), `trip-${A}`, { name: "Linterna", category: "Varios" }, `bag-${A}`);

    expect(created).toMatchObject({ suitcaseId: null });
    expect(fakeServiceDb.rows("packingItem").find((i) => i.id === created.id)).toMatchObject({ suitcaseId: null });
  });

  it("an edit keeps the item's bag and leaves it packed", async () => {
    await packing.updatePackingItem(agentActor(A, "all"), `trip-${A}`, `item-${A}`, { name: "Cepillo" }, null);

    expect(fakeServiceDb.rows("packingItem").find((i) => i.id === `item-${A}`)).toMatchObject({
      name: "Cepillo",
      suitcaseId: `bag-${A}`,
      packed: true,
    });
  });

  it("the web still moves the item to another bag and unpacks it", async () => {
    await packing.updatePackingItem(webActorOf(A), `trip-${A}`, `item-${A}`, { name: "Cepillo" }, null);

    expect(fakeServiceDb.rows("packingItem").find((i) => i.id === `item-${A}`)).toMatchObject({ suitcaseId: null, packed: false });
  });
});
