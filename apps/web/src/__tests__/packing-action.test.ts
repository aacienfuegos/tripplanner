import { describe, it, expect, vi, beforeEach } from "vitest";
import { DEFAULT_PACKING_ITEMS } from "@tripplanner/shared";
import {
  createPackingItem,
  updatePackingItem,
  togglePackingItem,
  deletePackingItem,
  addDefaultPackingItems,
  addDiveEquipmentToPackingList,
  movePackingItems,
  deletePackingItems,
  setPackedPackingItems,
  unpackAllPackingItems,
  copyPackingFromTrip,
} from "@/actions/packing";
import { fakeDb, fakePrisma } from "./helpers/fake-packing-db";
import { seedPacking } from "./helpers/packing-seed";

// redirect() throws in Next, which stops the action: the mock does the same.
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

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

async function expectNoWrite(action: () => Promise<unknown>, error: string) {
  const before = fakeDb.dump();
  await expect(action()).rejects.toThrow(error);
  expect(fakeDb.dump()).toEqual(before);
}

beforeEach(() => {
  seedPacking();
});

describe("createPackingItem (CA5)", () => {
  it("creates the item in the chosen bag", async () => {
    await createPackingItem("trip-own", form({ name: "Gafas", category: "Varios", quantity: "1", suitcaseId: "s-big" }));

    expect(fakeDb.items("trip-own")).toContainEqual(expect.objectContaining({ name: "Gafas", suitcaseId: "s-big" }));
  });

  it("creates the item with no bag when the field is empty or missing", async () => {
    await createPackingItem("trip-own", form({ name: "Gafas", category: "Varios", suitcaseId: "" }));
    await createPackingItem("trip-own", form({ name: "Gorra", category: "Varios", quantity: "3" }));

    expect(fakeDb.items("trip-own")).toContainEqual(expect.objectContaining({ name: "Gafas", suitcaseId: null, quantity: 1 }));
    expect(fakeDb.items("trip-own")).toContainEqual(expect.objectContaining({ name: "Gorra", suitcaseId: null, quantity: 3 }));
  });

  it("fails without writing when the bag is from another user's trip (CA22)", async () => {
    await expectNoWrite(
      () => createPackingItem("trip-own", form({ name: "Gafas", category: "Varios", suitcaseId: "s-other" })),
      "Suitcase not found",
    );
  });
});

describe("updatePackingItem", () => {
  it("moving to another bag unpacks the item (CA6)", async () => {
    await updatePackingItem(
      "trip-own",
      "i-1",
      form({ name: "Cepillo de dientes", category: "Aseo", quantity: "1", suitcaseId: "s-big" }),
    );

    expect(fakeDb.item("i-1")).toMatchObject({ suitcaseId: "s-big", packed: false });
  });

  it("moving to no bag also unpacks the item (CA6)", async () => {
    await updatePackingItem("trip-own", "i-1", form({ name: "Cepillo de dientes", category: "Aseo", suitcaseId: "" }));

    expect(fakeDb.item("i-1")).toMatchObject({ suitcaseId: null, packed: false });
  });

  it("editing name, category and quantity in the same bag keeps it packed (CA24)", async () => {
    await updatePackingItem("trip-own", "i-1", form({ name: "Cepillo", category: "Higiene", quantity: "2", suitcaseId: "s-cabin" }));

    expect(fakeDb.item("i-1")).toMatchObject({
      name: "Cepillo",
      category: "Higiene",
      quantity: 2,
      suitcaseId: "s-cabin",
      packed: true,
    });
  });

  it.each([
    ["no name", { name: " ", category: "Aseo", quantity: "1", suitcaseId: "s-cabin" }],
    ["a quantity below 1", { name: "Cepillo", category: "Aseo", quantity: "0", suitcaseId: "s-cabin" }],
    ["a quantity that is not a whole number", { name: "Cepillo", category: "Aseo", quantity: "1.5", suitcaseId: "s-cabin" }],
  ])("rejects %s without writing (CA24)", async (_case, fields) => {
    const before = fakeDb.dump();

    await expect(updatePackingItem("trip-own", "i-1", form(fields))).rejects.toThrow();

    expect(fakeDb.dump()).toEqual(before);
  });

  it("fails without writing when the item is from another user's trip (CA22)", async () => {
    await expectNoWrite(
      () => updatePackingItem("trip-own", "i-other", form({ name: "Mío", category: "Ropa", suitcaseId: "" })),
      "Packing item not found",
    );
  });

  it("fails without writing when the new bag is from another user's trip (CA22)", async () => {
    await expectNoWrite(
      () => updatePackingItem("trip-own", "i-1", form({ name: "Cepillo", category: "Aseo", suitcaseId: "s-other" })),
      "Suitcase not found",
    );
  });
});

describe("togglePackingItem / deletePackingItem", () => {
  it("toggle does not touch an item from another user's trip (CA22)", async () => {
    await expectNoWrite(() => togglePackingItem("trip-own", "i-other", false), "not found");
  });

  it("delete does not touch an item from another user's trip (CA22)", async () => {
    await expectNoWrite(() => deletePackingItem("trip-own", "i-other"), "not found");
  });

  it("toggle still works on the trip's own item (CA14)", async () => {
    await togglePackingItem("trip-own", "i-2", true);

    expect(fakeDb.item("i-2")).toMatchObject({ packed: true, suitcaseId: "s-cabin" });
  });
});

describe("addDefaultPackingItems (CA16)", () => {
  it("adds the default list to the chosen bag", async () => {
    await addDefaultPackingItems("trip-own-2", "s-own-2");

    const added = fakeDb.items("trip-own-2");
    expect(added.map((i) => i.name)).toEqual(DEFAULT_PACKING_ITEMS.map((d) => d.name));
    expect(added.every((i) => i.suitcaseId === "s-own-2" && i.packed === false)).toBe(true);
  });

  it("adds the default list with no bag when none is given, as the current screen calls it", async () => {
    await addDefaultPackingItems("trip-own-2");

    expect(fakeDb.items("trip-own-2")).toHaveLength(DEFAULT_PACKING_ITEMS.length);
    expect(fakeDb.items("trip-own-2").every((i) => i.suitcaseId === null)).toBe(true);
  });

  it("fails without writing when the bag is from another user's trip (CA22)", async () => {
    await expectNoWrite(() => addDefaultPackingItems("trip-own", "s-other"), "Suitcase not found");
  });
});

describe("addDiveEquipmentToPackingList (CA32)", () => {
  it("adds only the new equipment to the chosen bag and leaves the existing one where it was", async () => {
    await fakePrisma.packingItem.create({
      data: { id: "i-fins", tripId: "trip-own", suitcaseId: "s-cabin", category: "Buceo", name: "aletas" },
    });

    const result = await addDiveEquipmentToPackingList("trip-own", "s-big");

    expect(result).toEqual({ added: 1 });
    expect(fakeDb.items("trip-own")).toContainEqual(expect.objectContaining({ name: "Máscara", suitcaseId: "s-big" }));
    expect(fakeDb.item("i-fins")).toMatchObject({ suitcaseId: "s-cabin" });
    expect(fakeDb.items("trip-own").some((i) => i.name === "Regulador")).toBe(false);
  });

  it("adds the equipment with no bag when none is given", async () => {
    await addDiveEquipmentToPackingList("trip-own-2", null);

    expect(fakeDb.items("trip-own-2").map((i) => [i.name, i.suitcaseId])).toEqual([
      ["Aletas", null],
      ["Máscara", null],
    ]);
  });

  it("fails without writing when the bag is from another user's trip (CA22)", async () => {
    await expectNoWrite(() => addDiveEquipmentToPackingList("trip-own", "s-other"), "Suitcase not found");
  });
});

describe("movePackingItems (CA25)", () => {
  it("moves items from several groups to a bag, unpacking only the ones that change bag", async () => {
    await movePackingItems("trip-own", ["i-1", "i-3", "i-4"], "s-big");

    expect(fakeDb.item("i-1")).toMatchObject({ suitcaseId: "s-big", packed: false });
    expect(fakeDb.item("i-3")).toMatchObject({ suitcaseId: "s-big", packed: false });
    expect(fakeDb.item("i-4")).toMatchObject({ suitcaseId: "s-big", packed: true });
    expect(fakeDb.item("i-2")).toMatchObject({ suitcaseId: "s-cabin", packed: false });
  });

  it("moves items to no bag, leaving the ones already there as they were", async () => {
    await movePackingItems("trip-own", ["i-1", "i-3", "i-4"], null);

    expect(fakeDb.item("i-1")).toMatchObject({ suitcaseId: null, packed: false });
    expect(fakeDb.item("i-3")).toMatchObject({ suitcaseId: null, packed: true });
    expect(fakeDb.item("i-4")).toMatchObject({ suitcaseId: null, packed: false });
  });

  it("leaves an item from another user's trip mixed into the list untouched (CA22)", async () => {
    await movePackingItems("trip-own", ["i-1", "i-other"], "s-big");

    expect(fakeDb.item("i-1")).toMatchObject({ suitcaseId: "s-big" });
    expect(fakeDb.item("i-other")).toMatchObject({ suitcaseId: "s-other", packed: true });
  });

  it("fails without writing when the bag is from another user's trip (CA22)", async () => {
    await expectNoWrite(() => movePackingItems("trip-own", ["i-1"], "s-other"), "Suitcase not found");
  });

  it.each([
    ["an empty list", []],
    ["more than 1000 ids", Array.from({ length: 1001 }, (_, i) => `i-${i}`)],
  ])("rejects %s without writing", async (_case, ids) => {
    const before = fakeDb.dump();

    await expect(movePackingItems("trip-own", ids, null)).rejects.toThrow();

    expect(fakeDb.dump()).toEqual(before);
  });
});

describe("deletePackingItems (CA26)", () => {
  it("deletes the selected items and no others, also when an id from another trip is mixed in", async () => {
    await deletePackingItems("trip-own", ["i-1", "i-3", "i-other"]);

    expect(fakeDb.items("trip-own").map((i) => i.id)).toEqual(["i-2", "i-4"]);
    expect(fakeDb.item("i-other")).toBeDefined();
  });
});

describe("setPackedPackingItems (CA35)", () => {
  it("packs the selected items of two bags without moving them", async () => {
    await setPackedPackingItems("trip-own", ["i-2", "i-4"], true);

    expect(fakeDb.item("i-2")).toMatchObject({ packed: true, suitcaseId: "s-cabin" });
    expect(fakeDb.item("i-4")).toMatchObject({ packed: true, suitcaseId: "s-big" });
  });

  it("unpacks the selected items only, and not another trip's", async () => {
    await setPackedPackingItems("trip-own", ["i-1", "i-other"], false);

    expect(fakeDb.item("i-1")).toMatchObject({ packed: false, suitcaseId: "s-cabin" });
    expect(fakeDb.item("i-3")).toMatchObject({ packed: true });
    expect(fakeDb.item("i-other")).toMatchObject({ packed: true });
  });
});

describe("unpackAllPackingItems (CA34)", () => {
  it("unpacks one bag without touching the others", async () => {
    await unpackAllPackingItems("trip-own", "s-cabin");

    expect(fakeDb.item("i-1")).toMatchObject({ packed: false, suitcaseId: "s-cabin" });
    expect(fakeDb.item("i-3")).toMatchObject({ packed: true });
    expect(fakeDb.item("i-4")).toMatchObject({ packed: true });
  });

  it("unpacks the items with no bag when given null", async () => {
    await unpackAllPackingItems("trip-own", null);

    expect(fakeDb.item("i-3")).toMatchObject({ packed: false });
    expect(fakeDb.item("i-1")).toMatchObject({ packed: true });
  });

  it("unpacks the whole trip when no bag is given, and not another trip", async () => {
    await unpackAllPackingItems("trip-own");

    expect(fakeDb.items("trip-own").every((i) => i.packed === false)).toBe(true);
    expect(fakeDb.item("i-other")).toMatchObject({ packed: true });
  });

  it("fails without writing when the bag is from another user's trip (CA22)", async () => {
    await expectNoWrite(() => unpackAllPackingItems("trip-own", "s-other"), "Suitcase not found");
  });
});

describe("copyPackingFromTrip (CA37)", () => {
  it("copies bags without weight and items unpacked, reusing a bag with the same folded name", async () => {
    const result = await copyPackingFromTrip("trip-own-2", "trip-own");

    const suitcases = fakeDb.suitcases("trip-own-2");
    expect(suitcases.map((s) => [s.name, s.type, s.weightGrams])).toEqual([
      ["cabina", "BACKPACK", null],
      ["Grande", "CHECKED", null],
    ]);
    const bigId = suitcases[1].id;
    expect(fakeDb.items("trip-own-2").map((i) => [i.name, i.suitcaseId, i.packed, i.quantity])).toEqual([
      ["Cepillo de dientes", "s-own-2", false, 1],
      ["Camiseta", "s-own-2", false, 2],
      ["Cargador", null, false, 1],
      ["Chaqueta", bigId, false, 1],
    ]);
    expect(result).toEqual({ suitcases: 1, items: 4 });
  });

  it("leaves the source trip as it was", async () => {
    const before = fakeDb.dump();

    await copyPackingFromTrip("trip-own-2", "trip-own");

    const after = fakeDb.dump();
    expect(after.suitcase.filter((s) => s.tripId === "trip-own")).toEqual(
      before.suitcase.filter((s) => s.tripId === "trip-own"),
    );
    expect(after.packingItem.filter((i) => i.tripId === "trip-own")).toEqual(
      before.packingItem.filter((i) => i.tripId === "trip-own"),
    );
  });

  it("redirects and writes nothing when the source trip is another user's (CA22)", async () => {
    await expectNoWrite(() => copyPackingFromTrip("trip-own", "trip-other"), "NEXT_REDIRECT /trips");
  });

  it("refuses to copy a trip onto itself", async () => {
    await expectNoWrite(() => copyPackingFromTrip("trip-own", "trip-own"), "onto itself");
  });
});

describe("another user's trip (CA22)", () => {
  it.each([
    ["createPackingItem", () => createPackingItem("trip-other", form({ name: "X", category: "Y" }))],
    ["updatePackingItem", () => updatePackingItem("trip-other", "i-other", form({ name: "X", category: "Y" }))],
    ["togglePackingItem", () => togglePackingItem("trip-other", "i-other", false)],
    ["deletePackingItem", () => deletePackingItem("trip-other", "i-other")],
    ["addDefaultPackingItems", () => addDefaultPackingItems("trip-other", "s-other")],
    ["addDiveEquipmentToPackingList", () => addDiveEquipmentToPackingList("trip-other", "s-other")],
    ["movePackingItems", () => movePackingItems("trip-other", ["i-other"], null)],
    ["deletePackingItems", () => deletePackingItems("trip-other", ["i-other"])],
    ["setPackedPackingItems", () => setPackedPackingItems("trip-other", ["i-other"], false)],
    ["unpackAllPackingItems", () => unpackAllPackingItems("trip-other", "s-other")],
    ["copyPackingFromTrip", () => copyPackingFromTrip("trip-other", "trip-own")],
  ])("%s redirects and writes nothing", async (_name, action) => {
    await expectNoWrite(action, "NEXT_REDIRECT /trips");
  });
});
