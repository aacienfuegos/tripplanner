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
const diveLogFindMany = vi.fn();
const diveLogFindUnique = vi.fn();
const diveSiteFindUnique = vi.fn();
const tripFindUnique = vi.fn();
const userFindUnique = vi.fn();
const diveEquipmentFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    diveLog: {
      create: (...args: unknown[]) => diveLogCreate(...args),
      update: (...args: unknown[]) => diveLogUpdate(...args),
      delete: (...args: unknown[]) => diveLogDelete(...args),
      findMany: (...args: unknown[]) => diveLogFindMany(...args),
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
    diveEquipment: {
      findMany: (...args: unknown[]) => diveEquipmentFindMany(...args),
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
    diveLogFindMany.mockResolvedValue([]);
    diveEquipmentFindMany.mockResolvedValue([]);
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

  it("only connects equipment ids owned by the authenticated user (IDOR defense)", async () => {
    // The client submitted 3 equipment ids, but the userId-scoped lookup only
    // resolves 2 of them as actually belonging to this user.
    diveEquipmentFindMany.mockResolvedValue([{ id: "eq-1" }, { id: "eq-2" }]);

    const { createDiveLog } = await import("@/actions/dives");
    const formData = validDiveFormData();
    formData.append("equipmentIds", "eq-1");
    formData.append("equipmentIds", "eq-2");
    formData.append("equipmentIds", "eq-of-another-user");

    await createDiveLog(formData);

    expect(diveEquipmentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["eq-1", "eq-2", "eq-of-another-user"] }, userId: "user-attacker" },
      }),
    );
    expect(diveLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ equipment: { connect: [{ id: "eq-1" }, { id: "eq-2" }] } }),
      }),
    );
  });

  it("updateDiveLog replaces the equipment set (not additive) via connect: set", async () => {
    diveEquipmentFindMany.mockResolvedValue([{ id: "eq-1" }]);

    const { updateDiveLog } = await import("@/actions/dives");
    const formData = validDiveFormData();
    formData.append("equipmentIds", "eq-1");

    await updateDiveLog("dive-123", formData);

    expect(diveLogUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ equipment: { set: [{ id: "eq-1" }] } }) }),
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

describe("createDiveLog — diveNumber renumbered chronologically per user", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userFindUnique.mockResolvedValue({ status: "APPROVED" });
    diveEquipmentFindMany.mockResolvedValue([]);
  });

  it("assigns diveNumber 1 for a user's first (and only) dive", async () => {
    // renumberDives re-fetches after the insert — this is what the DB would
    // contain with just the one dive just created.
    diveLogFindMany.mockResolvedValue([{ id: "new-dive", diveNumber: 0 }]);

    const { createDiveLog } = await import("@/actions/dives");
    await createDiveLog(validDiveFormData());

    expect(diveLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ diveNumber: 0 }) }),
    );
    expect(diveLogUpdate).toHaveBeenCalledWith({
      where: { id: "new-dive" },
      data: { diveNumber: 1 },
    });
  });

  it("renumbers by chronological position (date asc), not insertion order", async () => {
    // findMany is queried orderBy date asc — two pre-existing dives already
    // correctly numbered, plus the new one inserted between them by date.
    diveLogFindMany.mockResolvedValue([
      { id: "d1", diveNumber: 1 },
      { id: "new-dive", diveNumber: 0 },
      { id: "d2", diveNumber: 2 },
    ]);

    const { createDiveLog } = await import("@/actions/dives");
    await createDiveLog(validDiveFormData());

    // d1 keeps #1 (unchanged, no update issued); the new dive becomes #2 and
    // d2 shifts to #3.
    expect(diveLogUpdate).not.toHaveBeenCalledWith(expect.objectContaining({ where: { id: "d1" } }));
    expect(diveLogUpdate).toHaveBeenCalledWith({ where: { id: "new-dive" }, data: { diveNumber: 2 } });
    expect(diveLogUpdate).toHaveBeenCalledWith({ where: { id: "d2" }, data: { diveNumber: 3 } });
  });

  it("scopes the renumbering query to the authenticated user, not global", async () => {
    // A malicious/careless implementation could renumber across all users'
    // dives; assert the where clause is userId-scoped so counts never leak
    // or collide across accounts.
    diveLogFindMany.mockResolvedValue([{ id: "new-dive", diveNumber: 0 }]);

    const { createDiveLog } = await import("@/actions/dives");
    await createDiveLog(validDiveFormData());

    const where = diveLogFindMany.mock.calls[0][0].where;
    expect(where).toEqual({ userId: "user-attacker" });
  });
});
