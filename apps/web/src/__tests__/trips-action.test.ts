import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/navigation redirect before importing the action
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock auth — the "attacker" is authenticated as user-attacker
vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "user-attacker" } }),
}));

const findUnique = vi.fn();
const update = vi.fn();
const del = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trip: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      update: (...args: unknown[]) => update(...args),
      delete: (...args: unknown[]) => del(...args),
    },
  },
}));

// ─── trips.ts: defense in depth — userId scoped in the mutation itself ────────
// assertTripOwner already redirects when the trip belongs to another user, so
// these tests target the mutation query shape directly: even if the ownership
// check were ever bypassed, the where clause alone must not be able to touch
// another user's trip.

describe("updateTrip / deleteTrip / updateTripStatus — userId in where", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Trip belongs to the authenticated user — ownership check passes.
    findUnique.mockResolvedValue({ userId: "user-attacker" });
  });

  it("updateTrip scopes prisma.trip.update by id and userId", async () => {
    const { updateTrip } = await import("@/actions/trips");
    const formData = new FormData();
    formData.set("name", "Japón 2026");
    formData.set("startDate", "2026-06-07");
    formData.set("endDate", "2026-06-21");

    await updateTrip("trip-123", formData);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "trip-123", userId: "user-attacker" } }),
    );
  });

  it("deleteTrip scopes prisma.trip.delete by id and userId", async () => {
    const { deleteTrip } = await import("@/actions/trips");

    await deleteTrip("trip-123");

    expect(del).toHaveBeenCalledWith({ where: { id: "trip-123", userId: "user-attacker" } });
  });

  it("updateTripStatus scopes prisma.trip.update by id and userId", async () => {
    const { updateTripStatus } = await import("@/actions/trips");

    await updateTripStatus("trip-123", "BOOKED");

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "trip-123", userId: "user-attacker" } }),
    );
  });

  it("never issues a mutation scoped only by id (no bare id-only where)", async () => {
    const { updateTrip, deleteTrip, updateTripStatus } = await import("@/actions/trips");
    const formData = new FormData();
    formData.set("name", "Japón 2026");
    formData.set("startDate", "2026-06-07");
    formData.set("endDate", "2026-06-21");

    await updateTrip("trip-123", formData);
    await deleteTrip("trip-123");
    await updateTripStatus("trip-123", "BOOKED");

    for (const call of [...update.mock.calls, ...del.mock.calls]) {
      const where = (call[0] as { where: Record<string, unknown> }).where;
      expect(where).toHaveProperty("userId");
    }
  });
});
