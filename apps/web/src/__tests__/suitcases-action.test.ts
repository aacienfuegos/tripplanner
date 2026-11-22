import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSuitcase, updateSuitcase, deleteSuitcase } from "@/actions/suitcases";
import { fakeDb } from "./helpers/fake-packing-db";
import { seedPacking } from "./helpers/packing-seed";

// redirect() throws in Next, which stops the action: the mock does the same.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", async () => {
  const { OWNER: user } = await import("./helpers/packing-seed");
  return { auth: vi.fn().mockResolvedValue({ user: { id: user } }) };
});
vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers/fake-packing-db")).fakePrisma }));

beforeEach(() => {
  seedPacking();
});

describe("createSuitcase", () => {
  it("stores name, type and weight in the trip (CA1)", async () => {
    await createSuitcase("trip-own", { name: " Mochila ", type: "BACKPACK", weightGrams: 4500 });

    expect(fakeDb.suitcases("trip-own")).toContainEqual(
      expect.objectContaining({ name: "Mochila", type: "BACKPACK", weightGrams: 4500 }),
    );
  });

  it("stores a bag without weight (CA2)", async () => {
    await createSuitcase("trip-own", { name: "Bolsa", type: "OTHER", weightGrams: null });

    expect(fakeDb.suitcases("trip-own")).toContainEqual(expect.objectContaining({ name: "Bolsa", weightGrams: null }));
  });

  it.each([
    ["no name", { name: "  ", type: "OTHER" as const, weightGrams: null }],
    ["a negative weight", { name: "Bolsa", type: "OTHER" as const, weightGrams: -1 }],
    ["a weight that is not a number", { name: "Bolsa", type: "OTHER" as const, weightGrams: Number.NaN }],
    ["a weight over the cap", { name: "Bolsa", type: "OTHER" as const, weightGrams: 1_000_001 }],
  ])("rejects %s and stores nothing (CA2)", async (_case, input) => {
    const before = fakeDb.dump();

    await expect(createSuitcase("trip-own", input)).rejects.toThrow();

    expect(fakeDb.dump()).toEqual(before);
  });
});

describe("updateSuitcase", () => {
  it("changes the bag's data and keeps its items in it (CA3)", async () => {
    await updateSuitcase("trip-own", "s-cabin", { name: "Cabina azul", type: "CABIN", weightGrams: 9000 });

    expect(fakeDb.suitcases("trip-own")).toContainEqual(
      expect.objectContaining({ id: "s-cabin", name: "Cabina azul", weightGrams: 9000 }),
    );
    expect(fakeDb.item("i-1")).toMatchObject({ suitcaseId: "s-cabin", packed: true });
    expect(fakeDb.item("i-2")).toMatchObject({ suitcaseId: "s-cabin" });
  });

  it("fails without writing when the bag is from another user's trip (CA22)", async () => {
    const before = fakeDb.dump();

    await expect(
      updateSuitcase("trip-own", "s-other", { name: "Mía", type: "OTHER", weightGrams: null }),
    ).rejects.toThrow("Suitcase not found");

    expect(fakeDb.dump()).toEqual(before);
  });
});

describe("deleteSuitcase", () => {
  it("unassign: removes the bag and leaves its items with no bag, unpacked (CA11)", async () => {
    await deleteSuitcase("trip-own", "s-cabin", "unassign");

    expect(fakeDb.suitcases("trip-own").map((s) => s.id)).toEqual(["s-big"]);
    expect(fakeDb.item("i-1")).toMatchObject({ suitcaseId: null, packed: false });
    expect(fakeDb.item("i-2")).toMatchObject({ suitcaseId: null, packed: false });
    expect(fakeDb.item("i-3")).toMatchObject({ suitcaseId: null, packed: true });
    expect(fakeDb.item("i-4")).toMatchObject({ suitcaseId: "s-big", packed: true });
  });

  it("deleteItems: removes the bag and its items, and nothing else (CA12)", async () => {
    await deleteSuitcase("trip-own", "s-cabin", "deleteItems");

    expect(fakeDb.suitcases("trip-own").map((s) => s.id)).toEqual(["s-big"]);
    expect(fakeDb.items("trip-own").map((i) => i.id)).toEqual(["i-3", "i-4"]);
    expect(fakeDb.items("trip-other")).toHaveLength(1);
  });

  it("deletes an empty bag (CA13)", async () => {
    await deleteSuitcase("trip-own-2", "s-own-2", "unassign");

    expect(fakeDb.suitcases("trip-own-2")).toEqual([]);
  });

  it.each(["unassign", "deleteItems"] as const)(
    "%s: fails without writing when the bag is from another user's trip (CA22)",
    async (mode) => {
      const before = fakeDb.dump();

      await expect(deleteSuitcase("trip-own", "s-other", mode)).rejects.toThrow("Suitcase not found");

      expect(fakeDb.dump()).toEqual(before);
    },
  );

  it("rejects an unknown mode without writing", async () => {
    const before = fakeDb.dump();

    await expect(deleteSuitcase("trip-own", "s-cabin", "everything" as "unassign")).rejects.toThrow();

    expect(fakeDb.dump()).toEqual(before);
  });
});

describe("another user's trip (CA22)", () => {
  it.each([
    ["createSuitcase", () => createSuitcase("trip-other", { name: "X", type: "OTHER", weightGrams: null })],
    ["updateSuitcase", () => updateSuitcase("trip-other", "s-other", { name: "X", type: "OTHER", weightGrams: null })],
    ["deleteSuitcase unassign", () => deleteSuitcase("trip-other", "s-other", "unassign")],
    ["deleteSuitcase deleteItems", () => deleteSuitcase("trip-other", "s-other", "deleteItems")],
  ])("%s redirects and writes nothing", async (_name, action) => {
    const before = fakeDb.dump();

    await expect(action()).rejects.toThrow("NEXT_REDIRECT /trips");

    expect(fakeDb.dump()).toEqual(before);
  });
});
