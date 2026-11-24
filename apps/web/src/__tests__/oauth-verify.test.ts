// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeOAuthDb } from "./helpers/fake-oauth-db";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers/fake-oauth-db")).fakeOAuthPrisma }));

import { verifyAccessToken } from "@/lib/oauth/verify";
import { generateSecret, secretHash } from "@/lib/oauth/tokens";

const CONFIG = { issuer: "https://trips.example.com", resource: "https://trips.example.com/api/mcp" };
const NOW = new Date("2026-11-24T12:00:00Z");
const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const token = generateSecret("tpat_");

function seed(overrides: { grant?: Record<string, unknown>; token?: Record<string, unknown>; client?: Record<string, unknown>; status?: string } = {}) {
  fakeOAuthDb.reset({
    user: [{ id: "user-a", status: overrides.status ?? "APPROVED" }],
    trip: [{ id: "trip-1", userId: "user-a" }],
    oAuthClient: [{ id: "client-1", clientId: "tpc_x", ownerUserId: "user-a", ...overrides.client }],
    agentGrant: [
      {
        id: "grant-1",
        userId: "user-a",
        clientId: "client-1",
        scopes: ["trips:read", "trips:write", "offline_access", "unknown:scope"],
        lastUsedAt: new Date(NOW.getTime() - MIN),
        ...overrides.grant,
      },
    ],
    agentGrantTrip: [{ grantId: "grant-1", tripId: "trip-1" }],
    oAuthToken: [
      {
        tokenHash: secretHash(token),
        kind: "ACCESS",
        grantId: "grant-1",
        resource: CONFIG.resource,
        expiresAt: new Date(NOW.getTime() + 30 * MIN),
        ...overrides.token,
      },
    ],
  });
}

beforeEach(() => seed());

describe("verifyAccessToken", () => {
  it("gives the user and the connection of a good token, with its hash and not its value", async () => {
    const verified = await verifyAccessToken(CONFIG, token, NOW);
    expect(verified).toMatchObject({ userId: "user-a", tokenHash: secretHash(token), clientId: "tpc_x" });
    expect(verified?.grant.id).toBe("grant-1");
    expect([...verified!.grant.tripIds]).toEqual(["trip-1"]);
    expect([...verified!.grant.scopes]).toEqual(["trips:read", "trips:write", "offline_access"]);
    expect(JSON.stringify({ ...verified, grant: null })).not.toContain(token);
  });

  it("writes the last use only when the stored one is more than 5 minutes old", async () => {
    await verifyAccessToken(CONFIG, token, NOW);
    expect(fakeOAuthDb.rows("agentGrant")[0].lastUsedAt).toEqual(new Date(NOW.getTime() - MIN));
    seed({ grant: { lastUsedAt: new Date(NOW.getTime() - 6 * MIN) } });
    await verifyAccessToken(CONFIG, token, NOW);
    expect(fakeOAuthDb.rows("agentGrant")[0].lastUsedAt).toEqual(NOW);
  });

  it.each([
    ["an invented token", () => generateSecret("tpat_"), {}],
    ["a refresh token", () => token, { token: { kind: "REFRESH" } }],
    ["an expired token", () => token, { token: { expiresAt: NOW } }],
    ["a token for another resource (staging vs production, CA3)", () => token, { token: { resource: "https://staging.example.com/api/mcp" } }],
    ["a revoked connection (CA16)", () => token, { grant: { revokedAt: NOW, revokedReason: "USER" } }],
    ["a deleted client (CA28)", () => token, { client: { deletedAt: NOW } }],
    ["a pending user (CA17)", () => token, { status: "PENDING" }],
    ["a denied user (CA17)", () => token, { status: "DENIED" }],
    ["something without the prefix", () => token.replace("tpat_", "tprt_"), {}],
  ])("rejects %s", async (_label, value, overrides) => {
    seed(overrides);
    await expect(verifyAccessToken(CONFIG, value(), NOW)).resolves.toBeNull();
  });

  it("brings the connection back when the user is approved again (CA17)", async () => {
    seed({ status: "PENDING" });
    await expect(verifyAccessToken(CONFIG, token, NOW)).resolves.toBeNull();
    fakeOAuthDb.rows("user")[0].status = "APPROVED";
    await expect(verifyAccessToken(CONFIG, token, NOW)).resolves.not.toBeNull();
  });

  it("treats 90 days without use as revoked and marks it INACTIVE (CA16)", async () => {
    seed({ grant: { lastUsedAt: new Date(NOW.getTime() - 91 * DAY) } });
    await expect(verifyAccessToken(CONFIG, token, NOW)).resolves.toBeNull();
    expect(fakeOAuthDb.rows("agentGrant")[0]).toMatchObject({ revokedReason: "INACTIVE", revokedAt: NOW });
    expect(fakeOAuthDb.rows("oAuthToken")).toHaveLength(0);
  });
});
