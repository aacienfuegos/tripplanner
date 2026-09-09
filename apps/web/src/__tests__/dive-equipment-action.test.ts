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

const diveEquipmentCreate = vi.fn();
const diveEquipmentUpdate = vi.fn();
const diveEquipmentDelete = vi.fn();
const userFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    diveEquipment: {
      create: (...args: unknown[]) => diveEquipmentCreate(...args),
      update: (...args: unknown[]) => diveEquipmentUpdate(...args),
      delete: (...args: unknown[]) => diveEquipmentDelete(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => userFindUnique(...args),
    },
  },
}));

function validEquipmentFormData() {
  const formData = new FormData();
  formData.set("name", "Traje semi-seco 5mm");
  formData.set("category", "WETSUIT");
  return formData;
}

describe("dive-equipment.ts — userId scoping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userFindUnique.mockResolvedValue({ status: "APPROVED" });
  });

  it("createDiveEquipment scopes prisma.diveEquipment.create to the authenticated user", async () => {
    const { createDiveEquipment } = await import("@/actions/dive-equipment");
    await createDiveEquipment(validEquipmentFormData());

    expect(diveEquipmentCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: "user-attacker" }) }),
    );
  });

  it("updateDiveEquipment scopes prisma.diveEquipment.update by id and userId", async () => {
    const { updateDiveEquipment } = await import("@/actions/dive-equipment");
    await updateDiveEquipment("eq-123", validEquipmentFormData());

    expect(diveEquipmentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "eq-123", userId: "user-attacker" } }),
    );
  });

  it("deleteDiveEquipment scopes prisma.diveEquipment.delete by id and userId", async () => {
    const { deleteDiveEquipment } = await import("@/actions/dive-equipment");
    await deleteDiveEquipment("eq-123");

    expect(diveEquipmentDelete).toHaveBeenCalledWith({ where: { id: "eq-123", userId: "user-attacker" } });
  });

  it("never issues a mutation scoped only by id (no bare id-only where)", async () => {
    const { updateDiveEquipment, deleteDiveEquipment } = await import("@/actions/dive-equipment");

    await updateDiveEquipment("eq-123", validEquipmentFormData());
    await deleteDiveEquipment("eq-123");

    for (const call of [...diveEquipmentUpdate.mock.calls, ...diveEquipmentDelete.mock.calls]) {
      const where = (call[0] as { where: Record<string, unknown> }).where;
      expect(where).toHaveProperty("userId");
    }
  });

  it("converts purchasePrice and serviceIntervalMonths from strings to numbers", async () => {
    const { createDiveEquipment } = await import("@/actions/dive-equipment");
    const formData = validEquipmentFormData();
    formData.set("purchasePrice", "349.90");
    formData.set("serviceIntervalMonths", "12");

    await createDiveEquipment(formData);

    expect(diveEquipmentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ purchasePrice: 349.9, serviceIntervalMonths: 12 }),
      }),
    );
  });
});

describe("isServiceDue", () => {
  it("flags equipment whose last service is older than the configured interval", async () => {
    const { isServiceDue } = await import("@/lib/equipment-service");
    const past = new Date();
    past.setFullYear(past.getFullYear() - 2);

    expect(isServiceDue({ lastServiceDate: past, serviceIntervalMonths: 12 })).toBe(true);
  });

  it("does not flag equipment serviced recently", async () => {
    const { isServiceDue } = await import("@/lib/equipment-service");
    const recent = new Date();

    expect(isServiceDue({ lastServiceDate: recent, serviceIntervalMonths: 12 })).toBe(false);
  });

  it("does not flag equipment with no service tracking configured", async () => {
    const { isServiceDue } = await import("@/lib/equipment-service");
    expect(isServiceDue({ lastServiceDate: null, serviceIntervalMonths: null })).toBe(false);
  });
});
