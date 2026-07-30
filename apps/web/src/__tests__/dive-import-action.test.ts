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

const geocodeDiveSite = vi.fn();
vi.mock("@/lib/geocode-items", () => ({
  geocodeDiveSite: (...args: unknown[]) => geocodeDiveSite(...args),
}));

const userFindUnique = vi.fn();
const diveSiteFindMany = vi.fn();
const diveSiteCreate = vi.fn();
const diveLogFindMany = vi.fn();
const diveLogFindManyTx = vi.fn();
const diveLogUpdateTx = vi.fn();
const diveLogCreateMany = vi.fn();
const diveCertificationFindMany = vi.fn();
const diveCertificationCreateMany = vi.fn();

function makeTx() {
  return {
    diveSite: { findMany: diveSiteFindMany, create: diveSiteCreate },
    diveLog: { createMany: diveLogCreateMany, findMany: diveLogFindManyTx, update: diveLogUpdateTx },
    diveCertification: { createMany: diveCertificationCreateMany },
  };
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: (...args: unknown[]) => userFindUnique(...args) },
    diveSite: { findMany: (...args: unknown[]) => diveSiteFindMany(...args) },
    diveLog: { findMany: (...args: unknown[]) => diveLogFindMany(...args) },
    diveCertification: { findMany: (...args: unknown[]) => diveCertificationFindMany(...args) },
    $transaction: (fn: (tx: unknown) => unknown) => fn(makeTx()),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  userFindUnique.mockResolvedValue({ status: "APPROVED" });
  diveSiteCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({ id: `site-${data.externalId}`, latitude: data.latitude, longitude: data.longitude }),
  );
  diveLogFindManyTx.mockResolvedValue([]);
  diveLogCreateMany.mockResolvedValue({ count: 0 });
  diveCertificationCreateMany.mockResolvedValue({ count: 0 });
  diveSiteFindMany.mockResolvedValue([]);
});

describe("checkDivingLogDuplicates", () => {
  it("flags entries whose externalId already exists for the user", async () => {
    diveSiteFindMany.mockResolvedValue([{ externalId: "site-ext-1", name: "Wreck Reef" }]);
    diveLogFindMany.mockResolvedValue([{ externalId: "log-ext-1" }]);
    diveCertificationFindMany.mockResolvedValue([]);

    const { checkDivingLogDuplicates } = await import("@/actions/dive-import");
    const flags = await checkDivingLogDuplicates({
      sites: [{ name: "Wreck Reef", externalId: "site-ext-1" }, { name: "New Site", externalId: "site-ext-2" }],
      logs: [
        { date: "2024-06-01", depthMax: "18", bottomTime: "45", gasMix: "AIR", externalId: "log-ext-1", diveSiteExternalId: null },
        { date: "2024-06-02", depthMax: "20", bottomTime: "40", gasMix: "AIR", externalId: "log-ext-2", diveSiteExternalId: null },
      ],
      certifications: [],
    });

    expect(flags.sites).toEqual([true, false]);
    expect(flags.logs).toEqual([true, false]);
  });
});

describe("bulkImportDivingLog", () => {
  it("creates sites, logs, and certifications scoped to the authenticated user", async () => {
    const { bulkImportDivingLog } = await import("@/actions/dive-import");
    const result = await bulkImportDivingLog({
      sites: [{ name: "Wreck Reef", externalId: "site-ext-1" }],
      logs: [
        { date: "2024-06-01", depthMax: "18", bottomTime: "45", gasMix: "AIR", externalId: "log-ext-1", diveSiteExternalId: "site-ext-1" },
      ],
      certifications: [{ agency: "PADI", level: "OW", externalId: "cert-ext-1" }],
    });

    expect(diveSiteCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: "user-1", externalId: "site-ext-1" }) }),
    );
    expect(diveLogCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ userId: "user-1", externalId: "log-ext-1", diveSiteId: "site-site-ext-1" })],
        skipDuplicates: true,
      }),
    );
    expect(diveCertificationCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true }),
    );
    expect(result).toEqual({ sites: 1, logs: 0, certifications: 0 });
  });

  it("creates rows with a placeholder diveNumber and renumbers by date afterward", async () => {
    diveLogCreateMany.mockResolvedValue({ count: 2 });
    // Simulates the post-insert state renumberDives reads back, already
    // ordered by date asc: one pre-existing dive (correctly #1, so it's left
    // untouched) followed by the two newly imported ones.
    diveLogFindManyTx.mockResolvedValue([
      { id: "existing-dive", diveNumber: 1 },
      { id: "new-log-1", diveNumber: 0 },
      { id: "new-log-2", diveNumber: 0 },
    ]);

    const { bulkImportDivingLog } = await import("@/actions/dive-import");
    await bulkImportDivingLog({
      sites: [],
      logs: [
        { date: "2024-06-01", depthMax: "18", bottomTime: "45", gasMix: "AIR", externalId: "log-ext-1", diveSiteExternalId: null },
        { date: "2024-06-02", depthMax: "20", bottomTime: "40", gasMix: "AIR", externalId: "log-ext-2", diveSiteExternalId: null },
      ],
      certifications: [],
    });

    const rows = diveLogCreateMany.mock.calls[0][0].data;
    expect(rows.map((r: { diveNumber: number }) => r.diveNumber)).toEqual([0, 0]);
    expect(diveLogUpdateTx).not.toHaveBeenCalledWith(expect.objectContaining({ where: { id: "existing-dive" } }));
    expect(diveLogUpdateTx).toHaveBeenCalledWith({ where: { id: "new-log-1" }, data: { diveNumber: 2 } });
    expect(diveLogUpdateTx).toHaveBeenCalledWith({ where: { id: "new-log-2" }, data: { diveNumber: 3 } });
  });

  it("skips creating a site that already exists for the user (matched by externalId)", async () => {
    diveSiteFindMany.mockResolvedValue([{ id: "existing-site-id", externalId: "site-ext-1" }]);

    const { bulkImportDivingLog } = await import("@/actions/dive-import");
    await bulkImportDivingLog({
      sites: [{ name: "Wreck Reef", externalId: "site-ext-1" }],
      logs: [],
      certifications: [],
    });

    expect(diveSiteCreate).not.toHaveBeenCalled();
  });

  it("kicks off best-effort geocoding for a newly created site without coordinates", async () => {
    const { bulkImportDivingLog } = await import("@/actions/dive-import");
    await bulkImportDivingLog({
      sites: [{ name: "Wreck Reef", externalId: "site-ext-1" }],
      logs: [],
      certifications: [],
    });

    expect(geocodeDiveSite).toHaveBeenCalledWith("site-site-ext-1");
  });
});
