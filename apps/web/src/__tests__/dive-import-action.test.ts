import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { readdirSync, rmSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildDivingLogFixture } from "./helpers/divinglog-fixture";

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
const diveLogAggregate = vi.fn();
const diveLogCreateMany = vi.fn();
const diveCertificationFindMany = vi.fn();
const diveCertificationCreateMany = vi.fn();

function makeTx() {
  return {
    diveSite: { findMany: diveSiteFindMany, create: diveSiteCreate },
    diveLog: { aggregate: diveLogAggregate, createMany: diveLogCreateMany },
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

const fixturePath = buildDivingLogFixture();

afterAll(() => {
  rmSync(path.dirname(fixturePath), { recursive: true, force: true });
});

async function fixtureAsFile(): Promise<File> {
  const bytes = readFileSync(fixturePath);
  return new File([bytes], "logbook.sqlite");
}

beforeEach(() => {
  vi.clearAllMocks();
  userFindUnique.mockResolvedValue({ status: "APPROVED" });
  diveSiteCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({ id: `site-${data.externalId}`, latitude: data.latitude, longitude: data.longitude }),
  );
  diveLogAggregate.mockResolvedValue({ _max: { diveNumber: null } });
  diveLogCreateMany.mockResolvedValue({ count: 0 });
  diveCertificationCreateMany.mockResolvedValue({ count: 0 });
  diveSiteFindMany.mockResolvedValue([]);
});

describe("parseDivingLogFile", () => {
  it("rejects a non-file value", async () => {
    const { parseDivingLogFile } = await import("@/actions/dive-import");
    const fd = new FormData();
    fd.set("file", "not-a-file");
    const result = await parseDivingLogFile(fd);
    expect(result.ok).toBe(false);
  });

  it("rejects a file over the size limit", async () => {
    const { parseDivingLogFile } = await import("@/actions/dive-import");
    const huge = new File([new Uint8Array(50 * 1024 * 1024 + 1)], "huge.sqlite");
    const fd = new FormData();
    fd.set("file", huge);
    const result = await parseDivingLogFile(fd);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe("FILE_TOO_LARGE");
  }, 15000);

  it("parses a valid Diving Log SQLite file into a payload", async () => {
    const { parseDivingLogFile } = await import("@/actions/dive-import");
    const fd = new FormData();
    fd.set("file", await fixtureAsFile());
    const result = await parseDivingLogFile(fd);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.sites).toHaveLength(3);
      expect(result.payload.logs).toHaveLength(4);
      expect(result.payload.certifications).toHaveLength(1);
    }
  });

  it("returns a clear error, not a throw, for a corrupt file", async () => {
    const { parseDivingLogFile } = await import("@/actions/dive-import");
    const fd = new FormData();
    fd.set("file", new File(["not a sqlite file at all"], "corrupt.sqlite"));
    const result = await parseDivingLogFile(fd);
    expect(result.ok).toBe(false);
  });

  it("always deletes the temp file, even after a parse failure", async () => {
    const { parseDivingLogFile } = await import("@/actions/dive-import");
    const before = readdirSync(os.tmpdir()).filter((f) => f.startsWith("divinglog-import-"));
    expect(before).toHaveLength(0);

    const fd = new FormData();
    fd.set("file", new File(["not a sqlite file at all"], "corrupt.sqlite"));
    await parseDivingLogFile(fd);

    const after = readdirSync(os.tmpdir()).filter((f) => f.startsWith("divinglog-import-"));
    expect(after).toHaveLength(0);
  });
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

  it("assigns incrementing diveNumbers starting after the user's current max", async () => {
    diveLogAggregate.mockResolvedValue({ _max: { diveNumber: 10 } });
    diveLogCreateMany.mockResolvedValue({ count: 2 });

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
    expect(rows.map((r: { diveNumber: number }) => r.diveNumber)).toEqual([11, 12]);
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
