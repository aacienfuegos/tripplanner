// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHash } from "node:crypto";
import { fakeOAuthDb, fakeOAuthPrisma } from "./helpers/fake-oauth-db";
import { endlessFormRequest } from "./helpers/endless-body";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers/fake-oauth-db")).fakeOAuthPrisma }));

import { POST } from "@/app/api/oauth/token/route";
import { generateSecret, secretHash } from "@/lib/oauth/tokens";

const ISSUER = "https://trips.example.com";
const RESOURCE = `${ISSUER}/api/mcp`;
const CLIENT = "tpc_AAAAAAAAAAAAAAAAAAAAAA";
const REDIRECT = "https://agent.example.com/callback";
const VERIFIER = "v".repeat(50);
const CHALLENGE = createHash("sha256").update(VERIFIER).digest("base64url");
const DAY = 24 * 60 * 60 * 1000;

let ipCounter = 0;
const nextIp = () => `198.51.100.${++ipCounter % 250}.${ipCounter}`;

function tokenRequest(params: Record<string, string>, ip = nextIp()): Request {
  return new Request(`${ISSUER}/api/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "cf-connecting-ip": ip },
    body: new URLSearchParams(params).toString(),
  });
}

// The limiters live in the route module for the whole file, so the tests of
// the limits use clients of their own.
let currentClient = CLIENT;

function seed(
  options: { scopes?: string[]; grant?: Record<string, unknown>; codeExpiresIn?: number; clientId?: string } = {},
) {
  const { scopes = ["trips:read", "offline_access"], grant = {}, codeExpiresIn = 60_000, clientId = CLIENT } = options;
  currentClient = clientId;
  const code = generateSecret("tpac_");
  fakeOAuthDb.reset({
    user: [{ id: "user-a" }],
    oAuthClient: [{ id: "client-1", clientId, kind: "MANUAL", redirectUris: [REDIRECT], ownerUserId: "user-a" }],
    agentGrant: [{ id: "grant-1", userId: "user-a", clientId: "client-1", scopes, lastUsedAt: new Date(), ...grant }],
    oAuthCode: [
      {
        codeHash: secretHash(code),
        grantId: "grant-1",
        redirectUri: REDIRECT,
        codeChallenge: CHALLENGE,
        resource: RESOURCE,
        expiresAt: new Date(Date.now() + codeExpiresIn),
      },
    ],
  });
  return code;
}

const exchange = (code: string, overrides: Record<string, string> = {}) =>
  POST(
    tokenRequest({
      grant_type: "authorization_code",
      code,
      client_id: currentClient,
      redirect_uri: REDIRECT,
      code_verifier: VERIFIER,
      ...overrides,
    }),
  );

const refresh = (refreshToken: string, overrides: Record<string, string> = {}, ip?: string) =>
  POST(tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: currentClient, ...overrides }, ip));

const grantRow = () => fakeOAuthDb.rows("agentGrant")[0];

beforeEach(() => {
  vi.stubEnv("AUTH_URL", ISSUER);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/oauth/token, authorization_code", () => {
  it("swaps a valid code for tokens, and only their hashes are stored (CA1)", async () => {
    const code = seed();
    const res = await exchange(code);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(body).toMatchObject({ token_type: "Bearer", expires_in: 3600, scope: "trips:read offline_access" });
    expect(body.access_token).toMatch(/^tpat_/);
    expect(body.refresh_token).toMatch(/^tprt_/);

    const stored = JSON.stringify(fakeOAuthDb.dump());
    for (const secret of [code, body.access_token, body.refresh_token]) expect(stored).not.toContain(secret);
    expect(fakeOAuthDb.rows("oAuthToken").map((t) => t.tokenHash).sort()).toEqual(
      [secretHash(body.access_token), secretHash(body.refresh_token)].sort(),
    );
  });

  it("gives no refresh token without offline_access", async () => {
    const body = await (await exchange(seed({ scopes: ["trips:read"] }))).json();
    expect(body.refresh_token).toBeUndefined();
  });

  it.each([
    ["without PKCE (CA3)", { code_verifier: "" }, "invalid_request"],
    ["with the wrong verifier", { code_verifier: "w".repeat(50) }, "invalid_grant"],
    ["with another redirect URI (CA3)", { redirect_uri: "https://agent.example.com/other" }, "invalid_grant"],
    ["with another client", { client_id: "tpc_BBBBBBBBBBBBBBBBBBBBBB" }, "invalid_grant"],
    ["for another resource", { resource: "https://staging.example.com/api/mcp" }, "invalid_target"],
  ])("rejects a request %s, without spending the code", async (_label, overrides, error) => {
    const code = seed();
    const res = await exchange(code, overrides);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error });
    expect(fakeOAuthDb.rows("oAuthCode")[0].usedAt).toBeNull();
    expect((await exchange(code)).status).toBe(200);
  });

  it("consumes the code with a where on usedAt and expiresAt", async () => {
    const spy = vi.spyOn(fakeOAuthPrisma.oAuthCode, "updateMany");
    await exchange(seed());
    expect(spy.mock.calls[0][0].where).toMatchObject({ usedAt: null, expiresAt: { gt: expect.any(Date) } });
  });

  it("a code used twice issues nothing more and revokes the connection (CA3)", async () => {
    const code = seed();
    expect((await exchange(code)).status).toBe(200);
    const res = await exchange(code);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_grant" });
    expect(grantRow()).toMatchObject({ revokedReason: "TOKEN_REUSE" });
    expect(fakeOAuthDb.rows("oAuthToken")).toHaveLength(0);
  });

  it("an expired code is refused without revoking anything", async () => {
    const code = seed({ codeExpiresIn: -1000 });
    expect((await exchange(code)).status).toBe(400);
    expect(grantRow().revokedAt).toBeNull();
  });

  it("of two exchanges of the same code at once, only one gets tokens", async () => {
    const createMany = vi.spyOn(fakeOAuthPrisma.oAuthToken, "createMany");
    const code = seed();
    const statuses = (await Promise.all([exchange(code), exchange(code)])).map((r) => r.status).sort();
    expect(statuses).toEqual([200, 400]);
    expect(createMany).toHaveBeenCalledTimes(1);
  });

  it("refuses a code of a revoked connection or of a pending user", async () => {
    expect((await exchange(seed({ grant: { revokedAt: new Date() } }))).status).toBe(400);
    const code = seed();
    fakeOAuthDb.rows("user")[0].status = "PENDING";
    expect((await exchange(code)).status).toBe(400);
  });
});

describe("POST /api/oauth/token, refresh_token", () => {
  async function tokens() {
    return (await exchange(seed())).json() as Promise<{ access_token: string; refresh_token: string }>;
  }

  it("rotates the refresh token, and one already spent revokes the whole connection (CA4)", async () => {
    const first = await tokens();
    const res = await refresh(first.refresh_token);
    expect(res.status).toBe(200);
    const second = await res.json();
    expect(second.refresh_token).not.toBe(first.refresh_token);

    const replay = await refresh(first.refresh_token);
    expect(await replay.json()).toEqual({ error: "invalid_grant" });
    expect(grantRow()).toMatchObject({ revokedReason: "TOKEN_REUSE" });
    expect(fakeOAuthDb.rows("oAuthToken")).toHaveLength(0);
    expect((await refresh(second.refresh_token)).status).toBe(400);
  });

  it("consumes the refresh token with a where on kind, usedAt and expiresAt", async () => {
    const { refresh_token } = await tokens();
    const spy = vi.spyOn(fakeOAuthPrisma.oAuthToken, "updateMany");
    await refresh(refresh_token);
    expect(spy.mock.calls[0][0].where).toMatchObject({ kind: "REFRESH", usedAt: null, expiresAt: { gt: expect.any(Date) } });
  });

  it("of two refreshes of the same token at once, one gets tokens and the connection ends revoked", async () => {
    const { refresh_token } = await tokens();
    const statuses = (await Promise.all([refresh(refresh_token), refresh(refresh_token)])).map((r) => r.status).sort();
    expect(statuses).toEqual([200, 400]);
    expect(grantRow()).toMatchObject({ revokedReason: "TOKEN_REUSE" });
  });

  it("fails once the connection is revoked (CA16)", async () => {
    const { refresh_token } = await tokens();
    grantRow().revokedAt = new Date();
    expect((await refresh(refresh_token)).status).toBe(400);
  });

  it("fails after 90 days without use, and marks the connection INACTIVE (CA16)", async () => {
    const { refresh_token } = await tokens();
    grantRow().lastUsedAt = new Date(Date.now() - 91 * DAY);
    expect(await (await refresh(refresh_token)).json()).toEqual({ error: "invalid_grant" });
    expect(grantRow()).toMatchObject({ revokedReason: "INACTIVE" });
  });

  it("fails once its client is deleted (CA28)", async () => {
    const { refresh_token } = await tokens();
    fakeOAuthDb.rows("oAuthClient")[0].deletedAt = new Date();
    const res = await refresh(refresh_token);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "invalid_client" });
  });

  it("refuses an access token or another client's refresh", async () => {
    const { access_token, refresh_token } = await tokens();
    expect((await refresh(access_token)).status).toBe(400);
    expect((await refresh(refresh_token, { client_id: "tpc_BBBBBBBBBBBBBBBBBBBBBB" })).status).toBe(400);
    expect((await refresh(refresh_token)).status).toBe(200);
  });
});

describe("POST /api/oauth/token, limits", () => {
  it("a valid refresh gets its tokens while the client is over its limit of failures; a failed one gets 429", async () => {
    const seeded = seed({ clientId: "tpc_LIMITLIMITLIMITLIMIT" });
    const { refresh_token } = (await (await exchange(seeded)).json()) as { refresh_token: string };
    for (let i = 0; i < 60; i++) {
      expect((await refresh(generateSecret("tprt_"))).status).toBe(400);
    }
    const failed = await refresh(generateSecret("tprt_"));
    expect(failed.status).toBe(429);
    expect(Number(failed.headers.get("retry-after"))).toBeGreaterThan(0);

    const valid = await refresh(refresh_token);
    expect(valid.status).toBe(200);
  });

  it("successful requests don't count against the client", async () => {
    const seeded = seed({ clientId: "tpc_SUCCESSSUCCESSSUCCES" });
    let { refresh_token } = (await (await exchange(seeded)).json()) as { refresh_token: string };
    for (let i = 0; i < 61; i++) {
      const res = await refresh(refresh_token);
      expect(res.status).toBe(200);
      refresh_token = (await res.json()).refresh_token;
    }
    expect((await refresh(generateSecret("tprt_"))).status).toBe(400);
  });

  it("allows 20 requests a minute per IP", async () => {
    const ip = "192.0.2.77";
    for (let i = 0; i < 20; i++) {
      expect((await refresh(generateSecret("tprt_"), { client_id: `tpc_ip${i}` }, ip)).status).toBe(400);
    }
    const res = await refresh(generateSecret("tprt_"), {}, ip);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).not.toBeNull();
  });
});

describe("POST /api/oauth/token, malformed requests", () => {
  it.each([
    [{ grant_type: "password", username: "a", password: "b" }, "unsupported_grant_type"],
    [{ code: "x" }, "invalid_request"],
    [{ grant_type: "refresh_token", client_id: "tpc_MALFORMEDMALFORMEDMA" }, "invalid_request"],
  ])("answers %j with %s", async (params, error) => {
    seed();
    expect(await (await POST(tokenRequest(params))).json()).toEqual({ error });
  });

  it("refuses JSON and repeated parameters", async () => {
    seed();
    const json = new Request(`${ISSUER}/api/oauth/token`, {
      method: "POST",
      headers: { "content-type": "application/json", "cf-connecting-ip": nextIp() },
      body: JSON.stringify({ grant_type: "refresh_token" }),
    });
    expect(await (await POST(json)).json()).toEqual({ error: "invalid_request" });
    const repeated = new Request(`${ISSUER}/api/oauth/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "cf-connecting-ip": nextIp() },
      body: "grant_type=refresh_token&client_id=a&client_id=b&refresh_token=x",
    });
    expect(await (await POST(repeated)).json()).toEqual({ error: "invalid_request" });
  });

  it("stops reading a body over 8 KB without Content-Length", async () => {
    seed();
    const { request, state } = endlessFormRequest(`${ISSUER}/api/oauth/token`, { "cf-connecting-ip": nextIp() });
    expect(request.headers.get("content-length")).toBeNull();
    expect(await (await POST(request)).json()).toEqual({ error: "invalid_request" });
    expect(state.cancelled).toBe(true);
    expect(state.pulled).toBeLessThanOrEqual(16);
  });

  it("is off (503) when AUTH_URL is not https", async () => {
    vi.stubEnv("AUTH_URL", "http://localhost:3000");
    expect((await exchange(seed())).status).toBe(503);
  });
});

describe("logs (CA25)", () => {
  function captureLogs() {
    return (["log", "info", "warn", "error", "debug"] as const).map((level) => vi.spyOn(console, level).mockImplementation(() => {}));
  }
  const logged = (spies: ReturnType<typeof captureLogs>) => JSON.stringify(spies.flatMap((spy) => spy.mock.calls));

  it("an invented token or an invalid code leaves no value in the logs, not even on a database error", async () => {
    const spies = captureLogs();
    seed();
    const invented = generateSecret("tprt_");
    const badCode = generateSecret("tpac_");
    await refresh(invented);
    await exchange(badCode);

    // A database error whose message echoes everything Prisma received.
    vi.spyOn(fakeOAuthPrisma.oAuthToken, "findUnique").mockImplementation(async (args) => {
      throw new Error(`Invalid prisma.oAuthToken.findUnique() invocation: ${JSON.stringify(args)}`);
    });
    const res = await refresh(invented);
    expect(res.status).toBe(500);

    const output = logged(spies);
    expect(output).toContain("server_error");
    expect(output).not.toContain(invented);
    expect(output).not.toContain(badCode);
    expect(output).not.toContain(secretHash(invented));
  });
});
