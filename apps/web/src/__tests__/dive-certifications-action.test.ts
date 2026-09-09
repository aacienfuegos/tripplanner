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

const diveCertificationCreate = vi.fn();
const diveCertificationUpdate = vi.fn();
const diveCertificationDelete = vi.fn();
const userFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    diveCertification: {
      create: (...args: unknown[]) => diveCertificationCreate(...args),
      update: (...args: unknown[]) => diveCertificationUpdate(...args),
      delete: (...args: unknown[]) => diveCertificationDelete(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => userFindUnique(...args),
    },
  },
}));

function validCertificationFormData() {
  const formData = new FormData();
  formData.set("agency", "PADI");
  formData.set("level", "Open Water");
  return formData;
}

describe("dive-certifications.ts — userId scoping on update/delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userFindUnique.mockResolvedValue({ status: "APPROVED" });
  });

  it("updateDiveCertification scopes prisma.diveCertification.update by id and userId", async () => {
    const { updateDiveCertification } = await import("@/actions/dive-certifications");

    await updateDiveCertification("cert-123", validCertificationFormData());

    expect(diveCertificationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "cert-123", userId: "user-attacker" } }),
    );
  });

  it("deleteDiveCertification scopes prisma.diveCertification.delete by id and userId", async () => {
    const { deleteDiveCertification } = await import("@/actions/dive-certifications");

    await deleteDiveCertification("cert-123");

    expect(diveCertificationDelete).toHaveBeenCalledWith({
      where: { id: "cert-123", userId: "user-attacker" },
    });
  });

  it("never issues a mutation scoped only by id (no bare id-only where)", async () => {
    const { updateDiveCertification, deleteDiveCertification } = await import("@/actions/dive-certifications");

    await updateDiveCertification("cert-123", validCertificationFormData());
    await deleteDiveCertification("cert-123");

    for (const call of [...diveCertificationUpdate.mock.calls, ...diveCertificationDelete.mock.calls]) {
      const where = (call[0] as { where: Record<string, unknown> }).where;
      expect(where).toHaveProperty("userId");
    }
  });

  it("createDiveCertification scopes prisma.diveCertification.create to the authenticated user", async () => {
    const { createDiveCertification } = await import("@/actions/dive-certifications");

    await createDiveCertification(validCertificationFormData());

    expect(diveCertificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: "user-attacker" }) }),
    );
  });
});
