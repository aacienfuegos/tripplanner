import { describe, it, expect, vi, beforeEach } from "vitest";
import { redirect } from "next/navigation";

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

const diveLogCreate = vi.fn();
const diveLogUpdate = vi.fn();
const diveLogDelete = vi.fn();
const diveLogAggregate = vi.fn();
const diveLogFindUnique = vi.fn();
const diveSiteFindUnique = vi.fn();
const tripFindUnique = vi.fn();
const userFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    diveLog: {
      create: (...args: unknown[]) => diveLogCreate(...args),
      update: (...args: unknown[]) => diveLogUpdate(...args),
      delete: (...args: unknown[]) => diveLogDelete(...args),
      aggregate: (...args: unknown[]) => diveLogAggregate(...args),
      findUnique: (...args: unknown[]) => diveLogFindUnique(...args),
    },
    diveSite: {
      findUnique: (...args: unknown[]) => diveSiteFindUnique(...args),
    },
    trip: {
      findUnique: (...args: unknown[]) => tripFindUnique(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => userFindUnique(...args),
    },
  },
}));

function validDiveFormData() {
  const formData = new FormData();
  formData.set("date", "2026-08-01");
  formData.set("depthMax", "18.5");
  formData.set("bottomTime", "45");
  return formData;
}

describe("dives.ts — userId scoping on update/delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userFindUnique.mockResolvedValue({ status: "APPROVED" });
    diveLogAggregate.mockResolvedValue({ _max: { diveNumber: null } });
  });

  it("updateDiveLog scopes prisma.diveLog.update by id and userId", async () => {
    const { updateDiveLog } = await import("@/actions/dives");

    await updateDiveLog("dive-123", validDiveFormData());

    expect(diveLogUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "dive-123", userId: "user-attacker" } }),
    );
  });

  it("deleteDiveLog scopes prisma.diveLog.delete by id and userId", async () => {
    const { deleteDiveLog } = await import("@/actions/dives");

    await deleteDiveLog("dive-123");

    expect(diveLogDelete).toHaveBeenCalledWith({ where: { id: "dive-123", userId: "user-attacker" } });
  });

  it("never issues a mutation scoped only by id (no bare id-only where)", async () => {
    const { updateDiveLog, deleteDiveLog } = await import("@/actions/dives");

    await updateDiveLog("dive-123", validDiveFormData());
    await deleteDiveLog("dive-123");

    for (const call of [...diveLogUpdate.mock.calls, ...diveLogDelete.mock.calls]) {
      const where = (call[0] as { where: Record<string, unknown> }).where;
      expect(where).toHaveProperty("userId");
    }
  });

  it("does not attach a diveSiteId belonging to another user (IDOR defense)", async () => {
    // A dive site owned by "user-2" — the attacker submits its id anyway.
    diveSiteFindUnique.mockResolvedValue({ userId: "user-2" });

    const { createDiveLog } = await import("@/actions/dives");
    const formData = validDiveFormData();
    formData.set("diveSiteId", "site-of-another-user");

    await createDiveLog(formData);

    expect(diveLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ diveSiteId: null }) }),
    );
  });

  it("attaches diveSiteId when the site belongs to the authenticated user", async () => {
    diveSiteFindUnique.mockResolvedValue({ userId: "user-attacker" });

    const { createDiveLog } = await import("@/actions/dives");
    const formData = validDiveFormData();
    formData.set("diveSiteId", "site-123");

    await createDiveLog(formData);

    expect(diveLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ diveSiteId: "site-123" }) }),
    );
  });

  it("does not attach a tripId belonging to another user's trip (IDOR defense)", async () => {
    // A trip owned by "user-2" — the attacker submits its id via the hidden
    // form field used to pre-link a dive created from a trip page.
    tripFindUnique.mockResolvedValue({ userId: "user-2" });

    const { createDiveLog } = await import("@/actions/dives");
    const formData = validDiveFormData();
    formData.set("tripId", "trip-of-another-user");

    await createDiveLog(formData);

    expect(diveLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tripId: null }) }),
    );
  });

  it("attaches tripId when the trip belongs to the authenticated user", async () => {
    tripFindUnique.mockResolvedValue({ userId: "user-attacker" });

    const { createDiveLog } = await import("@/actions/dives");
    const formData = validDiveFormData();
    formData.set("tripId", "trip-123");

    await createDiveLog(formData);

    expect(diveLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tripId: "trip-123" }) }),
    );
  });
});

describe("linkDiveToTrip — dive and trip ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userFindUnique.mockResolvedValue({ status: "APPROVED" });
  });

  it("links a dive the user owns to a trip the user owns", async () => {
    tripFindUnique.mockResolvedValue({ userId: "user-attacker" });

    const { linkDiveToTrip } = await import("@/actions/dives");
    await linkDiveToTrip("dive-1", "trip-1");

    expect(diveLogUpdate).toHaveBeenCalledWith({
      where: { id: "dive-1", userId: "user-attacker" },
      data: { tripId: "trip-1" },
    });
  });

  it("refuses to link to a trip owned by another user and never mutates the dive", async () => {
    // requireTripOwner redirects (and Next aborts the action) when the trip
    // isn't the caller's — simulate that abort and assert no mutation ran.
    tripFindUnique.mockResolvedValue({ userId: "user-2" });
    vi.mocked(redirect).mockImplementationOnce(() => {
      throw new Error("NEXT_REDIRECT");
    });

    const { linkDiveToTrip } = await import("@/actions/dives");
    await expect(linkDiveToTrip("dive-1", "trip-of-another-user")).rejects.toThrow("NEXT_REDIRECT");

    expect(diveLogUpdate).not.toHaveBeenCalled();
  });

  it("scopes the diveLog update by id and userId (defense in depth against a foreign dive)", async () => {
    // Even if diveId belongs to another user, the mutation itself must stay
    // scoped by userId so Prisma's where clause is the last line of defense.
    tripFindUnique.mockResolvedValue({ userId: "user-attacker" });

    const { linkDiveToTrip } = await import("@/actions/dives");
    await linkDiveToTrip("dive-of-another-user", "trip-1");

    const where = diveLogUpdate.mock.calls[0][0].where;
    expect(where).toEqual({ id: "dive-of-another-user", userId: "user-attacker" });
  });
});

describe("unlinkDiveFromTrip — clears tripId without deleting the record", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userFindUnique.mockResolvedValue({ status: "APPROVED" });
    diveLogFindUnique.mockResolvedValue({ tripId: "trip-1" });
  });

  it("sets tripId to null, scoped by id and userId, without deleting", async () => {
    const { unlinkDiveFromTrip } = await import("@/actions/dives");
    await unlinkDiveFromTrip("dive-1");

    expect(diveLogUpdate).toHaveBeenCalledWith({
      where: { id: "dive-1", userId: "user-attacker" },
      data: { tripId: null },
    });
    expect(diveLogDelete).not.toHaveBeenCalled();
  });
});

describe("createDiveLog — diveNumber correlative per user", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userFindUnique.mockResolvedValue({ status: "APPROVED" });
  });

  it("assigns diveNumber 1 for a user's first dive", async () => {
    diveLogAggregate.mockResolvedValue({ _max: { diveNumber: null } });

    const { createDiveLog } = await import("@/actions/dives");
    await createDiveLog(validDiveFormData());

    expect(diveLogAggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-attacker" } }),
    );
    expect(diveLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ diveNumber: 1 }) }),
    );
  });

  it("assigns the next diveNumber after the user's current max", async () => {
    diveLogAggregate.mockResolvedValue({ _max: { diveNumber: 7 } });

    const { createDiveLog } = await import("@/actions/dives");
    await createDiveLog(validDiveFormData());

    expect(diveLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ diveNumber: 8 }) }),
    );
  });

  it("scopes the diveNumber aggregate to the authenticated user, not global", async () => {
    // A malicious/careless implementation could aggregate across all users'
    // dives; assert the where clause is userId-scoped so counts never leak
    // or collide across accounts.
    diveLogAggregate.mockResolvedValue({ _max: { diveNumber: 3 } });

    const { createDiveLog } = await import("@/actions/dives");
    await createDiveLog(validDiveFormData());

    const where = diveLogAggregate.mock.calls[0][0].where;
    expect(where).toEqual({ userId: "user-attacker" });
  });
});
