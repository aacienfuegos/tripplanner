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
const userFindUnique = vi.fn();
const expenseFindMany = vi.fn();
const expenseUpdate = vi.fn();
const getExchangeRateMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trip: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      update: (...args: unknown[]) => update(...args),
      delete: (...args: unknown[]) => del(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => userFindUnique(...args),
    },
    expense: {
      findMany: (...args: unknown[]) => expenseFindMany(...args),
      update: (...args: unknown[]) => expenseUpdate(...args),
    },
  },
}));

vi.mock("@/lib/exchangeRate", () => ({
  getExchangeRate: (...args: unknown[]) => getExchangeRateMock(...args),
}));

// ─── trips.ts: defense in depth — userId scoped in the mutation itself ────────
// assertTripOwner already redirects when the trip belongs to another user, so
// these tests target the mutation query shape directly: even if the ownership
// check were ever bypassed, the where clause alone must not be able to touch
// another user's trip.

describe("updateTrip / deleteTrip / updateTripStatus — userId in where", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // requireUser()'s status revalidation (#177) passes — user isn't DENIED.
    userFindUnique.mockResolvedValue({ status: "APPROVED" });
    // Trip belongs to the authenticated user — ownership check passes.
    // currency: "EUR" matches tripSchema's default, so these tests (which
    // don't set a currency field in formData) don't trigger a currency change.
    findUnique.mockResolvedValue({ userId: "user-attacker", currency: "EUR" });
    expenseFindMany.mockResolvedValue([]);
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

// ─── issue #160: recalcular conversión de moneda al cambiar la del viaje ──────
// resolveConversion (expenses.ts) solo calcula exchangeRate/convertedAmount al
// crear/editar un gasto — si luego cambia trip.currency, esos valores quedan
// obsoletos (incluidos los que tenían convertedAmount: null por coincidir con
// la moneda anterior). updateTrip debe recalcularlos todos cuando cambia.

describe("updateTrip — recalcula conversión de gastos al cambiar moneda", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userFindUnique.mockResolvedValue({ status: "APPROVED" });
  });

  function formDataWithCurrency(currency: string) {
    const formData = new FormData();
    formData.set("name", "Japón 2026");
    formData.set("startDate", "2026-06-07");
    formData.set("endDate", "2026-06-21");
    formData.set("currency", currency);
    return formData;
  }

  it("recalcula todos los gastos del viaje cuando cambia la moneda", async () => {
    findUnique.mockResolvedValue({ userId: "user-attacker", currency: "EUR" });
    expenseFindMany.mockResolvedValue([
      { id: "expense-1", currency: "EUR", amount: 100 }, // antes coincidía con la moneda del viaje → convertedAmount era null
      { id: "expense-2", currency: "GBP", amount: 50 },
    ]);
    getExchangeRateMock.mockResolvedValue(1.15);

    const { updateTrip } = await import("@/actions/trips");
    await updateTrip("trip-123", formDataWithCurrency("USD"));

    expect(expenseFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tripId: "trip-123" } }));
    expect(expenseUpdate).toHaveBeenCalledWith({
      where: { id: "expense-1" },
      data: { exchangeRate: 1.15, convertedAmount: expect.closeTo(115, 5) },
    });
    expect(expenseUpdate).toHaveBeenCalledWith({
      where: { id: "expense-2" },
      data: { exchangeRate: 1.15, convertedAmount: expect.closeTo(57.5, 5) },
    });
  });

  it("no toca los gastos si la moneda del viaje no cambia", async () => {
    findUnique.mockResolvedValue({ userId: "user-attacker", currency: "USD" });

    const { updateTrip } = await import("@/actions/trips");
    await updateTrip("trip-123", formDataWithCurrency("USD"));

    expect(expenseFindMany).not.toHaveBeenCalled();
    expect(expenseUpdate).not.toHaveBeenCalled();
  });

  it("deja convertedAmount en null para un gasto cuya moneda coincide con la nueva del viaje", async () => {
    findUnique.mockResolvedValue({ userId: "user-attacker", currency: "EUR" });
    expenseFindMany.mockResolvedValue([{ id: "expense-1", currency: "USD", amount: 80 }]);

    const { updateTrip } = await import("@/actions/trips");
    await updateTrip("trip-123", formDataWithCurrency("USD"));

    expect(expenseUpdate).toHaveBeenCalledWith({
      where: { id: "expense-1" },
      data: { exchangeRate: null, convertedAmount: null },
    });
    expect(getExchangeRateMock).not.toHaveBeenCalled();
  });
});
