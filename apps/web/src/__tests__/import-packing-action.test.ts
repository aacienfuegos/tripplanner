import { describe, it, expect, vi, beforeEach } from "vitest";
import { importPayloadSchema } from "@tripplanner/shared";
import { bulkImport } from "@/actions/import";
import { fakeDb } from "./helpers/fake-packing-db";
import { seedPacking } from "./helpers/packing-seed";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", async () => {
  const { OWNER } = await import("./helpers/packing-seed");
  return { auth: vi.fn().mockResolvedValue({ user: { id: OWNER } }) };
});
vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers/fake-packing-db")).fakePrisma }));

const payload = (packing: unknown[]) => importPayloadSchema.parse({ packing });

beforeEach(() => {
  seedPacking();
});

describe("bulkImport with bags", () => {
  it("reuses a bag whose name matches without case or accents, and creates one bag per new name (CA17, CA18)", async () => {
    const before = fakeDb.suitcases("trip-own").length;

    await bulkImport("trip-own", payload([
      { name: "Linterna", category: "Varios", suitcase: "Mochila roja" },
      { name: "Navaja", category: "Varios", suitcase: "mochila ROJA" },
      { name: "Pijama", category: "Ropa", suitcase: "cabina" },
    ]));

    const suitcases = fakeDb.suitcases("trip-own");
    expect(suitcases).toHaveLength(before + 1);
    const red = suitcases.find((s) => s.name === "Mochila roja");
    expect(red).toMatchObject({ type: "OTHER", weightGrams: null });
    const items = fakeDb.items("trip-own");
    expect(items.find((i) => i.name === "Linterna")?.suitcaseId).toBe(red?.id);
    expect(items.find((i) => i.name === "Navaja")?.suitcaseId).toBe(red?.id);
    expect(items.find((i) => i.name === "Pijama")?.suitcaseId).toBe("s-cabin");
  });

  it("imports items without a bag as before, with no bag (CA19)", async () => {
    const before = fakeDb.suitcases("trip-own").length;

    await bulkImport("trip-own", payload([
      { name: "Toalla", category: "Aseo", quantity: 2 },
      { name: "Gorro", category: "Ropa", suitcase: "" },
      { name: "Bufanda", category: "Ropa", suitcase: null },
    ]));

    expect(fakeDb.suitcases("trip-own")).toHaveLength(before);
    const imported = fakeDb.items("trip-own").filter((i) => ["Toalla", "Gorro", "Bufanda"].includes(i.name as string));
    expect(imported.map((i) => [i.name, i.suitcaseId])).toEqual([
      ["Toalla", null],
      ["Gorro", null],
      ["Bufanda", null],
    ]);
  });

  it("does not use another user's bag with the same name (CA22)", async () => {
    await bulkImport("trip-own", payload([{ name: "Libro", category: "Varios", suitcase: "Ajena" }]));

    const item = fakeDb.items("trip-own").find((i) => i.name === "Libro");
    expect(item?.suitcaseId).not.toBe("s-other");
    expect(fakeDb.suitcases("trip-own").find((s) => s.id === item?.suitcaseId)).toMatchObject({ name: "Ajena" });
  });
});
