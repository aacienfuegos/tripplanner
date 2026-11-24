import { describe, it, expect, vi, beforeEach } from "vitest";

// Two users' trips in memory. The fake findMany evaluates the where clause the
// function sends, and rejects any shape it doesn't know, so the test checks
// which trips come out and not only the arguments.
type FakeTrip = { id: string; name: string; userId: string; packingItems: number; suitcases: number };

const TRIPS: readonly FakeTrip[] = [
  { id: "own-current", name: "Actual", userId: "user-a", packingItems: 3, suitcases: 1 },
  { id: "own-items", name: "Con objetos", userId: "user-a", packingItems: 2, suitcases: 0 },
  { id: "own-suitcases", name: "Con maletas", userId: "user-a", packingItems: 0, suitcases: 1 },
  { id: "own-empty", name: "Vacío", userId: "user-a", packingItems: 0, suitcases: 0 },
  { id: "other-full", name: "Del otro", userId: "user-b", packingItems: 5, suitcases: 2 },
];

type Where = {
  userId: string;
  id: { not: string };
  OR: [{ packingItems: { some: object } }, { suitcases: { some: object } }];
};

function isWhere(w: unknown): w is Where {
  if (typeof w !== "object" || w === null) return false;
  const keys = Object.keys(w).sort().join(",");
  const or = (w as { OR?: unknown }).OR;
  return (
    keys === "OR,id,userId" &&
    typeof (w as Where).userId === "string" &&
    typeof (w as Where).id?.not === "string" &&
    JSON.stringify(or) === JSON.stringify([{ packingItems: { some: {} } }, { suitcases: { some: {} } }])
  );
}

const tripFindMany = vi.fn(async (args: { where: unknown; select: Record<string, boolean> }) => {
  if (!isWhere(args.where)) throw new Error(`unexpected where: ${JSON.stringify(args.where)}`);
  const { userId, id } = args.where;
  return TRIPS.filter((t) => t.userId === userId && t.id !== id.not && (t.packingItems > 0 || t.suitcases > 0))
    .map((t) => Object.fromEntries(Object.keys(args.select).map((k) => [k, t[k as keyof FakeTrip]])));
});

vi.mock("@/lib/prisma", () => ({
  prisma: { trip: { findMany: (args: never) => tripFindMany(args) } },
}));

describe("listTripsToCopyFrom", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists the user's other trips that have items or bags", async () => {
    const { listTripsToCopyFrom } = await import("@/lib/packing-trips");
    const trips = await listTripsToCopyFrom("user-a", "own-current");
    expect(trips.map((t) => t.id).sort()).toEqual(["own-items", "own-suitcases"]);
  });

  it("does not list another user's trips, the current trip or empty trips", async () => {
    const { listTripsToCopyFrom } = await import("@/lib/packing-trips");
    const ids = (await listTripsToCopyFrom("user-a", "own-current")).map((t) => t.id);
    expect(ids).not.toContain("other-full");
    expect(ids).not.toContain("own-current");
    expect(ids).not.toContain("own-empty");
  });

  it("the other user only sees their own trips", async () => {
    const { listTripsToCopyFrom } = await import("@/lib/packing-trips");
    const trips = await listTripsToCopyFrom("user-b", "own-current");
    expect(trips.map((t) => t.id)).toEqual(["other-full"]);
  });

  it("returns only the id and name of each trip", async () => {
    const { listTripsToCopyFrom } = await import("@/lib/packing-trips");
    const [trip] = await listTripsToCopyFrom("user-b", "x");
    expect(trip).toEqual({ id: "other-full", name: "Del otro" });
  });
});
