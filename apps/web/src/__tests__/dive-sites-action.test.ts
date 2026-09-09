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

vi.mock("@/lib/geocode-items", () => ({
  geocodeDiveSite: vi.fn(),
}));

const diveAreaCreate = vi.fn();
const diveAreaUpdate = vi.fn();
const diveAreaDelete = vi.fn();
const diveAreaFindUnique = vi.fn();
const diveSiteUpdate = vi.fn();
const diveSiteDelete = vi.fn();
const diveSiteFindUnique = vi.fn();
const userFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    diveArea: {
      create: (...args: unknown[]) => diveAreaCreate(...args),
      update: (...args: unknown[]) => diveAreaUpdate(...args),
      delete: (...args: unknown[]) => diveAreaDelete(...args),
      findUnique: (...args: unknown[]) => diveAreaFindUnique(...args),
    },
    diveSite: {
      update: (...args: unknown[]) => diveSiteUpdate(...args),
      delete: (...args: unknown[]) => diveSiteDelete(...args),
      findUnique: (...args: unknown[]) => diveSiteFindUnique(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => userFindUnique(...args),
    },
  },
}));

function validAreaFormData() {
  const formData = new FormData();
  formData.set("name", "Cabo de Palos");
  return formData;
}

function validSiteFormData(diveAreaId?: string) {
  const formData = new FormData();
  formData.set("name", "Bajo de Dentro");
  if (diveAreaId) formData.set("diveAreaId", diveAreaId);
  return formData;
}

describe("dive-sites.ts — DiveArea CRUD scoping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userFindUnique.mockResolvedValue({ status: "APPROVED" });
  });

  it("createDiveArea scopes prisma.diveArea.create to the authenticated user", async () => {
    const { createDiveArea } = await import("@/actions/dive-sites");
    await createDiveArea(validAreaFormData());

    expect(diveAreaCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: "user-attacker" }) }),
    );
  });

  it("updateDiveArea scopes prisma.diveArea.update by id and userId", async () => {
    const { updateDiveArea } = await import("@/actions/dive-sites");
    await updateDiveArea("area-123", validAreaFormData());

    expect(diveAreaUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "area-123", userId: "user-attacker" } }),
    );
  });

  it("deleteDiveArea scopes prisma.diveArea.delete by id and userId", async () => {
    const { deleteDiveArea } = await import("@/actions/dive-sites");
    await deleteDiveArea("area-123");

    expect(diveAreaDelete).toHaveBeenCalledWith({ where: { id: "area-123", userId: "user-attacker" } });
  });
});

describe("dive-sites.ts — DiveSite update/delete scoping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userFindUnique.mockResolvedValue({ status: "APPROVED" });
    diveSiteFindUnique.mockResolvedValue({ address: null });
  });

  it("updateDiveSite scopes prisma.diveSite.update by id and userId", async () => {
    const { updateDiveSite } = await import("@/actions/dive-sites");
    await updateDiveSite("site-123", validSiteFormData());

    expect(diveSiteUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "site-123", userId: "user-attacker" } }),
    );
  });

  it("deleteDiveSite scopes prisma.diveSite.delete by id and userId", async () => {
    const { deleteDiveSite } = await import("@/actions/dive-sites");
    await deleteDiveSite("site-123");

    expect(diveSiteDelete).toHaveBeenCalledWith({ where: { id: "site-123", userId: "user-attacker" } });
  });

  it("does not attach a diveAreaId belonging to another user (IDOR defense)", async () => {
    diveAreaFindUnique.mockResolvedValue({ userId: "user-2" });

    const { updateDiveSite } = await import("@/actions/dive-sites");
    await updateDiveSite("site-123", validSiteFormData("area-of-another-user"));

    expect(diveSiteUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ diveAreaId: null }) }),
    );
  });

  it("attaches diveAreaId when the area belongs to the authenticated user", async () => {
    diveAreaFindUnique.mockResolvedValue({ userId: "user-attacker" });

    const { updateDiveSite } = await import("@/actions/dive-sites");
    await updateDiveSite("site-123", validSiteFormData("area-123"));

    expect(diveSiteUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ diveAreaId: "area-123" }) }),
    );
  });
});
