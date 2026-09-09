import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
}));

const destinationCreate = vi.fn();
const destinationUpdate = vi.fn();
const destinationDelete = vi.fn();
const destinationFindMany = vi.fn();
const tripFindUnique = vi.fn();
const userFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    destination: {
      create: (...args: unknown[]) => destinationCreate(...args),
      update: (...args: unknown[]) => destinationUpdate(...args),
      delete: (...args: unknown[]) => destinationDelete(...args),
      findMany: (...args: unknown[]) => destinationFindMany(...args),
    },
    trip: {
      findUnique: (...args: unknown[]) => tripFindUnique(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => userFindUnique(...args),
    },
  },
}));

function validFormData() {
  const formData = new FormData();
  formData.set("city", "Kioto");
  formData.set("country", "JP");
  formData.set("arrivalDate", "2026-06-10");
  formData.set("departureDate", "2026-06-15");
  return formData;
}

describe("destinations.ts — scoping and reorder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userFindUnique.mockResolvedValue({ status: "APPROVED" });
    tripFindUnique.mockResolvedValue({ userId: "user-1", currency: "EUR" });
    destinationFindMany.mockResolvedValue([]);
  });

  it("createDestination scopes prisma.destination.create by tripId", async () => {
    const { createDestination } = await import("@/actions/destinations");
    await createDestination("trip-123", validFormData());

    expect(destinationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tripId: "trip-123", city: "Kioto", country: "JP" }),
      }),
    );
  });

  it("updateDestination scopes prisma.destination.update by id and tripId", async () => {
    const { updateDestination } = await import("@/actions/destinations");
    await updateDestination("trip-123", "dest-1", validFormData());

    expect(destinationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "dest-1", tripId: "trip-123" } }),
    );
  });

  it("deleteDestination scopes prisma.destination.delete by id and tripId", async () => {
    const { deleteDestination } = await import("@/actions/destinations");
    await deleteDestination("trip-123", "dest-1");

    expect(destinationDelete).toHaveBeenCalledWith({ where: { id: "dest-1", tripId: "trip-123" } });
  });

  it("rejects a country that isn't a valid ISO 3166-1 alpha-2 code", async () => {
    const { createDestination } = await import("@/actions/destinations");
    const formData = validFormData();
    formData.set("country", "Japan");

    await expect(createDestination("trip-123", formData)).rejects.toThrow();
  });

  // El orden se deriva de arrivalDate en vez de pedir que el usuario reordene
  // a mano — createDestination/updateDestination/deleteDestination llaman a
  // reorderDestinations, que reasigna `order` por fecha de llegada ascendente.
  it("reorders all destinations of the trip by arrivalDate after create", async () => {
    destinationFindMany.mockResolvedValue([
      { id: "dest-early" },
      { id: "dest-mid" },
      { id: "dest-late" },
    ]);

    const { createDestination } = await import("@/actions/destinations");
    await createDestination("trip-123", validFormData());

    expect(destinationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tripId: "trip-123" }, orderBy: { arrivalDate: "asc" } }),
    );
    expect(destinationUpdate).toHaveBeenCalledWith({ where: { id: "dest-early" }, data: { order: 0 } });
    expect(destinationUpdate).toHaveBeenCalledWith({ where: { id: "dest-mid" }, data: { order: 1 } });
    expect(destinationUpdate).toHaveBeenCalledWith({ where: { id: "dest-late" }, data: { order: 2 } });
  });
});
