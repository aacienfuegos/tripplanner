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

const diveEquipmentFindUnique = vi.fn();
const diveEquipmentServiceCreate = vi.fn();
const diveEquipmentServiceDelete = vi.fn();
const userFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    diveEquipment: {
      findUnique: (...args: unknown[]) => diveEquipmentFindUnique(...args),
    },
    diveEquipmentService: {
      create: (...args: unknown[]) => diveEquipmentServiceCreate(...args),
      delete: (...args: unknown[]) => diveEquipmentServiceDelete(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => userFindUnique(...args),
    },
  },
}));

function validServiceFormData(equipmentId = "eq-own") {
  const formData = new FormData();
  formData.set("equipmentId", equipmentId);
  formData.set("date", "2026-05-01");
  formData.set("description", "Revisión regulador");
  return formData;
}

describe("dive-equipment.ts — equipment service history — userId scoping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userFindUnique.mockResolvedValue({ status: "APPROVED" });
  });

  it("createDiveEquipmentService rejects equipment owned by another user", async () => {
    diveEquipmentFindUnique.mockResolvedValue(null);
    const { createDiveEquipmentService } = await import("@/actions/dive-equipment");

    await expect(createDiveEquipmentService(validServiceFormData("eq-other-user"))).rejects.toThrow();

    expect(diveEquipmentFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "eq-other-user", userId: "user-attacker" } }),
    );
    expect(diveEquipmentServiceCreate).not.toHaveBeenCalled();
  });

  it("createDiveEquipmentService scopes prisma.diveEquipmentService.create to the authenticated user", async () => {
    diveEquipmentFindUnique.mockResolvedValue({ id: "eq-own" });
    const { createDiveEquipmentService } = await import("@/actions/dive-equipment");

    await createDiveEquipmentService(validServiceFormData());

    expect(diveEquipmentServiceCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: "user-attacker", equipmentId: "eq-own" }) }),
    );
  });

  it("deleteDiveEquipmentService scopes prisma.diveEquipmentService.delete by id and userId", async () => {
    diveEquipmentServiceDelete.mockResolvedValue({ equipmentId: "eq-own" });
    const { deleteDiveEquipmentService } = await import("@/actions/dive-equipment");

    await deleteDiveEquipmentService("svc-123");

    expect(diveEquipmentServiceDelete).toHaveBeenCalledWith({ where: { id: "svc-123", userId: "user-attacker" } });
  });

  it("converts cost from string to number", async () => {
    diveEquipmentFindUnique.mockResolvedValue({ id: "eq-own" });
    const { createDiveEquipmentService } = await import("@/actions/dive-equipment");
    const formData = validServiceFormData();
    formData.set("cost", "59.90");

    await createDiveEquipmentService(formData);

    expect(diveEquipmentServiceCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ cost: 59.9 }) }),
    );
  });
});
