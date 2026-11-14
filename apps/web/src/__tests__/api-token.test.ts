import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiRequest, jsonRequest } from "./helpers/api-request";

const apiTokenFindUnique = vi.fn();
const apiTokenUpdate = vi.fn();
const usageCreate = vi.fn();
const usageDeleteMany = vi.fn();
const tripFindFirst = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    apiToken: {
      findUnique: (...args: unknown[]) => apiTokenFindUnique(...args),
      update: (...args: unknown[]) => apiTokenUpdate(...args),
    },
    apiTokenUsage: {
      create: (...args: unknown[]) => usageCreate(...args),
      deleteMany: (...args: unknown[]) => usageDeleteMany(...args),
    },
    trip: { findFirst: (...args: unknown[]) => tripFindFirst(...args) },
    $transaction: (ops: unknown[]) => Promise.all(ops),
  },
}));

import {
  authenticateApiRequest,
  findOwnedTrip,
  generateApiToken,
  hashApiToken,
  withApiToken,
} from "@/lib/api-token";
import { apiJson, readJsonBody } from "@/lib/api-http";

const TOKEN = `tp_${"A".repeat(43)}`;
const URL_WITH_QUERY = "http://localhost/api/v1/trips?secret=1";

function tokenRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "tok-1",
    userId: "user-1",
    scopes: ["TRIPS_READ"],
    expiresAt: null,
    revokedAt: null,
    user: { status: "APPROVED" },
    ...overrides,
  };
}

function bearer(token: string = TOKEN, url: string = URL_WITH_QUERY) {
  return apiRequest({ url, headers: { authorization: `Bearer ${token}` } });
}

function printable(arg: unknown): string {
  if (arg instanceof Error) return `${arg.message}\n${arg.stack ?? ""}`;
  return typeof arg === "string" ? arg : JSON.stringify(arg);
}

const okHandler = withApiToken("trips:read", async () => apiJson(200, { ok: true }));

beforeEach(() => {
  vi.clearAllMocks();
  apiTokenFindUnique.mockResolvedValue(tokenRecord());
  usageCreate.mockResolvedValue({});
  apiTokenUpdate.mockResolvedValue({});
  usageDeleteMany.mockResolvedValue({ count: 0 });
});

describe("generateApiToken", () => {
  it("creates a tp_ token of 46 characters with a 10-character prefix", () => {
    const { token, prefix, tokenHash } = generateApiToken();
    expect(token).toMatch(/^tp_[A-Za-z0-9_-]{43}$/);
    expect(token).toHaveLength(46);
    expect(prefix).toBe(token.slice(0, 10));
    expect(tokenHash).toBe(hashApiToken(token));
  });

  it("hashes deterministically to sha256 hex", () => {
    expect(hashApiToken(TOKEN)).toBe(hashApiToken(TOKEN));
    expect(hashApiToken(TOKEN)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashApiToken(TOKEN)).not.toBe(hashApiToken(`tp_${"B".repeat(43)}`));
  });

  it("generates a different token each time", () => {
    expect(generateApiToken().token).not.toBe(generateApiToken().token);
  });
});

describe("authenticateApiRequest", () => {
  it("returns 401 without Authorization header", async () => {
    const result = await authenticateApiRequest(apiRequest(), "trips:read");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
    expect(apiTokenFindUnique).not.toHaveBeenCalled();
  });

  it("returns 401 with a scheme other than Bearer", async () => {
    const request = apiRequest({ headers: { authorization: `Basic ${TOKEN}` } });
    const result = await authenticateApiRequest(request, "trips:read");
    expect(result.ok).toBe(false);
    expect(apiTokenFindUnique).not.toHaveBeenCalled();
  });

  it("accepts the Bearer scheme case-insensitively", async () => {
    const request = apiRequest({ headers: { authorization: `bearer ${TOKEN}` } });
    const result = await authenticateApiRequest(request, "trips:read");
    expect(result).toEqual({ ok: true, userId: "user-1", tokenId: "tok-1" });
  });

  it.each([["tp_short"], [`xx_${"A".repeat(43)}`], [`tp_${"A".repeat(42)}!`], [`tp_${"A".repeat(44)}`]])(
    "returns 401 for malformed token %s without querying the DB",
    async (token) => {
      const result = await authenticateApiRequest(bearer(token), "trips:read");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.response.status).toBe(401);
      expect(apiTokenFindUnique).not.toHaveBeenCalled();
    },
  );

  it("looks the token up by its hash", async () => {
    await authenticateApiRequest(bearer(), "trips:read");
    expect(apiTokenFindUnique).toHaveBeenCalledWith({
      where: { tokenHash: hashApiToken(TOKEN) },
      include: { user: { select: { status: true } } },
    });
  });

  it.each([
    ["unknown", null],
    ["revoked", tokenRecord({ revokedAt: new Date("2026-01-01") })],
    ["expired", tokenRecord({ expiresAt: new Date(Date.now() - 1000) })],
  ])("returns the same generic 401 for an %s token", async (_label, record) => {
    apiTokenFindUnique.mockResolvedValue(record);
    const result = await authenticateApiRequest(bearer(), "trips:read");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(401);
    expect(result.tokenId).toBeNull();
    const body = await result.response.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("accepts a token whose expiry is in the future", async () => {
    apiTokenFindUnique.mockResolvedValue(tokenRecord({ expiresAt: new Date(Date.now() + 60_000) }));
    const result = await authenticateApiRequest(bearer(), "trips:read");
    expect(result.ok).toBe(true);
  });

  it("returns 403 when the token lacks the scope", async () => {
    const result = await authenticateApiRequest(bearer(), "activities:write");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(403);
    expect(result.tokenId).toBe("tok-1");
  });

  it.each([["PENDING"], ["DENIED"]])("returns 403 when the user is %s", async (status) => {
    apiTokenFindUnique.mockResolvedValue(tokenRecord({ user: { status } }));
    const result = await authenticateApiRequest(bearer(), "trips:read");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });
});

describe("withApiToken", () => {
  it("does not log a 401", async () => {
    apiTokenFindUnique.mockResolvedValue(null);
    const response = await okHandler(bearer(), { params: Promise.resolve({}) });
    expect(response.status).toBe(401);
    expect(usageCreate).not.toHaveBeenCalled();
    expect(apiTokenUpdate).not.toHaveBeenCalled();
  });

  it("logs a 403", async () => {
    const handler = withApiToken("equipment:write", async () => apiJson(201, {}));
    const response = await handler(bearer(), { params: Promise.resolve({}) });
    expect(response.status).toBe(403);
    expect(usageCreate).toHaveBeenCalledWith({
      data: { tokenId: "tok-1", method: "GET", path: "/api/v1/trips", status: 403, fields: [], resourceId: null },
    });
  });

  it("logs only tokenId, method, path without query, status, fields and resourceId", async () => {
    const response = await okHandler(bearer(), { params: Promise.resolve({}) });
    expect(response.status).toBe(200);
    expect(usageCreate).toHaveBeenCalledTimes(1);
    const { data } = usageCreate.mock.calls[0][0];
    expect(Object.keys(data).sort()).toEqual(["fields", "method", "path", "resourceId", "status", "tokenId"]);
    expect(data).toEqual({
      tokenId: "tok-1",
      method: "GET",
      path: "/api/v1/trips",
      status: 200,
      fields: [],
      resourceId: null,
    });
    expect(apiTokenUpdate).toHaveBeenCalledWith({
      where: { id: "tok-1" },
      data: { lastUsedAt: expect.any(Date) },
    });
  });

  it("logs a 500 that keeps the audit set before the handler threw", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = withApiToken("trips:read", async (_request, { audit }) => {
      audit.fields = ["name", "city"];
      audit.resourceId = "act-9";
      throw new Error("boom");
    });
    const response = await handler(bearer(), { params: Promise.resolve({}) });
    expect(response.status).toBe(500);
    expect((await response.json()).error).toEqual({ code: "INTERNAL", message: "Internal error" });
    expect(usageCreate.mock.calls[0][0].data).toMatchObject({
      status: 500,
      fields: ["name", "city"],
      resourceId: "act-9",
    });
  });

  it("prunes the usage log of every token older than 90 days", async () => {
    const before = Date.now();
    await okHandler(bearer(), { params: Promise.resolve({}) });
    expect(usageDeleteMany).toHaveBeenCalledTimes(1);
    const { where } = usageDeleteMany.mock.calls[0][0];
    expect(where).not.toHaveProperty("tokenId");
    const cutoff: Date = where.createdAt.lt;
    const ninetyDays = 90 * 24 * 60 * 60 * 1000;
    expect(before - cutoff.getTime()).toBeGreaterThanOrEqual(ninetyDays - 1000);
    expect(before - cutoff.getTime()).toBeLessThanOrEqual(ninetyDays + 1000);
  });

  it("sends Cache-Control: no-store on a 401 and on a 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const unauthorized = await okHandler(apiRequest(), { params: Promise.resolve({}) });
    expect(unauthorized.status).toBe(401);
    expect(unauthorized.headers.get("cache-control")).toBe("no-store");

    const failing = withApiToken("trips:read", async () => {
      throw new Error("boom");
    });
    const internal = await failing(bearer(), { params: Promise.resolve({}) });
    expect(internal.status).toBe(500);
    expect(internal.headers.get("cache-control")).toBe("no-store");
  });

  it("never writes the token, the Authorization header or the body to the console", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation(() => {}),
    );
    const secretBody = { name: "codigo-puerta-4821" };
    const handler = withApiToken("trips:read", async (request) => {
      await readJsonBody(request);
      throw new Error("boom");
    });
    const response = await handler(jsonRequest("POST", URL_WITH_QUERY, TOKEN, secretBody), {
      params: Promise.resolve({}),
    });
    expect(response.status).toBe(500);

    const printed = spies.flatMap((spy) => spy.mock.calls.flat()).map(printable);
    expect(printed.length).toBeGreaterThan(0);
    for (const text of printed) {
      expect(text).not.toContain(TOKEN);
      expect(text).not.toContain("Bearer");
      expect(text).not.toContain("codigo-puerta-4821");
    }
  });
});

describe("findOwnedTrip", () => {
  it("puts the userId in the where clause", async () => {
    tripFindFirst.mockResolvedValue({ id: "trip-1" });
    await expect(findOwnedTrip("trip-1", "user-1")).resolves.toEqual({ id: "trip-1" });
    expect(tripFindFirst).toHaveBeenCalledWith({ where: { id: "trip-1", userId: "user-1" }, select: { id: true } });
  });

  it("returns null when the trip is not the user's", async () => {
    tripFindFirst.mockResolvedValue(null);
    await expect(findOwnedTrip("trip-2", "user-1")).resolves.toBeNull();
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
