import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// The "attacker" is authenticated as user-attacker.
vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "user-attacker" } }),
}));

const diveEquipmentFindMany = vi.fn();
const packingItemFindMany = vi.fn();
const packingItemCreateMany = vi.fn();
const tripFindUnique = vi.fn();
const userFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    diveEquipment: {
      findMany: (...args: unknown[]) => diveEquipmentFindMany(...args),
    },
    packingItem: {
      findMany: (...args: unknown[]) => packingItemFindMany(...args),
      createMany: (...args: unknown[]) => packingItemCreateMany(...args),
    },
    trip: {
      findUnique: (...args: unknown[]) => tripFindUnique(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => userFindUnique(...args),
    },
  },
}));

describe("addDiveEquipmentToPackingList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userFindUnique.mockResolvedValue({ status: "APPROVED" });
    tripFindUnique.mockResolvedValue({ userId: "user-attacker", currency: "EUR" });
    packingItemFindMany.mockResolvedValue([]);
  });

  it("queries dive equipment scoped to the authenticated user and OWNED status only", async () => {
    diveEquipmentFindMany.mockResolvedValue([]);
    const { addDiveEquipmentToPackingList } = await import("@/actions/packing");

    await addDiveEquipmentToPackingList("trip-123");

    expect(diveEquipmentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-attacker", status: "OWNED" } }),
    );
  });

  it("creates a packing item per owned equipment piece, scoped to the trip", async () => {
    diveEquipmentFindMany.mockResolvedValue([{ name: "Traje semi-seco 5mm" }, { name: "Ordenador de buceo" }]);
    const { addDiveEquipmentToPackingList } = await import("@/actions/packing");

    const result = await addDiveEquipmentToPackingList("trip-123");

    expect(packingItemCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({ tripId: "trip-123", name: "Traje semi-seco 5mm" }),
          expect.objectContaining({ tripId: "trip-123", name: "Ordenador de buceo" }),
        ],
      }),
    );
    expect(result).toEqual({ added: 2 });
  });

  it("does not duplicate packing items that already exist for the trip (case-insensitive)", async () => {
    diveEquipmentFindMany.mockResolvedValue([{ name: "Aletas" }, { name: "Máscara" }]);
    packingItemFindMany.mockResolvedValue([{ name: "aletas" }]);
    const { addDiveEquipmentToPackingList } = await import("@/actions/packing");

    const result = await addDiveEquipmentToPackingList("trip-123");

    expect(packingItemCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: [expect.objectContaining({ name: "Máscara" })] }),
    );
    expect(result).toEqual({ added: 1 });
  });

  it("skips the createMany call entirely when there is nothing new to add", async () => {
    diveEquipmentFindMany.mockResolvedValue([{ name: "Aletas" }]);
    packingItemFindMany.mockResolvedValue([{ name: "Aletas" }]);
    const { addDiveEquipmentToPackingList } = await import("@/actions/packing");

    const result = await addDiveEquipmentToPackingList("trip-123");

    expect(packingItemCreateMany).not.toHaveBeenCalled();
    expect(result).toEqual({ added: 0 });
  });

  it("rejects when the trip belongs to another user", async () => {
    tripFindUnique.mockResolvedValue({ userId: "someone-else", currency: "EUR" });
    const { redirect } = await import("next/navigation");
    diveEquipmentFindMany.mockResolvedValue([{ name: "Aletas" }]);
    const { addDiveEquipmentToPackingList } = await import("@/actions/packing");

    await addDiveEquipmentToPackingList("trip-123");

    expect(redirect).toHaveBeenCalledWith("/trips");
  });
});
