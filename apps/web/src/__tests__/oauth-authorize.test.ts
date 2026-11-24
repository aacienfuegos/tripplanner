// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";
import { fakeOAuthDb, fakeOAuthPrisma } from "./helpers/fake-oauth-db";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers/fake-oauth-db")).fakeOAuthPrisma }));
vi.mock("@/lib/oauth/cimd", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/oauth/cimd")>()),
  fetchClientMetadata: vi.fn(),
}));

import { fetchClientMetadata } from "@/lib/oauth/cimd";
import { prepareAuthorization, type AuthorizeParams } from "@/lib/oauth/authorize";
import { decideConsent } from "@/lib/oauth/consent";

const CONFIG = { issuer: "https://trips.example.com", resource: "https://trips.example.com/api/mcp" };
const NOW = new Date("2026-11-24T12:00:00Z");
const A = "user-a";
const B = "user-b";
const CLIENT_A = "tpc_AAAAAAAAAAAAAAAAAAAAAA";
const CLIENT_B = "tpc_BBBBBBBBBBBBBBBBBBBBBB";
const REDIRECT = "https://agent.example.com/callback";
const CIMD_ID = "https://agents.example.com/oauth/client.json";
const CHALLENGE = createHash("sha256").update("v".repeat(50)).digest("base64url");
const ALL_SCOPES = "trips:read trips:suggest trips:write trips:delete dives:read dives:write dives:delete offline_access";

function seed(statusA = "APPROVED") {
  fakeOAuthDb.reset({
    user: [{ id: A, status: statusA }, { id: B }],
    trip: [
      { id: "trip-a1", userId: A, name: "Japón" },
      { id: "trip-a2", userId: A, name: "Islandia" },
      { id: "trip-b1", userId: B, name: "Perú" },
    ],
    oAuthClient: [
      { id: "client-a", clientId: CLIENT_A, kind: "MANUAL", name: "Agente de A", redirectUris: [REDIRECT], ownerUserId: A },
      { id: "client-b", clientId: CLIENT_B, kind: "MANUAL", name: "Agente de B", redirectUris: [REDIRECT], ownerUserId: B },
    ],
  });
}

const params = (overrides: Record<string, string | string[] | undefined> = {}): AuthorizeParams => ({
  response_type: "code",
  client_id: CLIENT_A,
  redirect_uri: REDIRECT,
  code_challenge: CHALLENGE,
  code_challenge_method: "S256",
  scope: ALL_SCOPES,
  state: "st4te",
  resource: CONFIG.resource,
  ...overrides,
});

beforeEach(() => {
  seed();
  vi.mocked(fetchClientMetadata).mockReset();
  vi.mocked(fetchClientMetadata).mockResolvedValue({ name: "Paperclip", redirectUris: [REDIRECT] });
});

describe("prepareAuthorization", () => {
  it("a pending user gets no code, and nothing is fetched or stored (CA2)", async () => {
    seed("PENDING");
    const outcome = await prepareAuthorization(CONFIG, A, params({ client_id: CIMD_ID }), NOW);
    expect(outcome).toEqual({ kind: "error", reason: "not_approved" });
    expect(fetchClientMetadata).not.toHaveBeenCalled();
    expect(fakeOAuthDb.rows("oAuthClient")).toHaveLength(2);
    expect(fakeOAuthDb.rows("oAuthAuthorizationRequest")).toHaveLength(0);
  });

  it("stores the request with the hash of its CSRF token, for the user of the session", async () => {
    const outcome = await prepareAuthorization(CONFIG, A, params(), NOW);
    expect(outcome.kind).toBe("consent");
    if (outcome.kind !== "consent") return;
    const [stored] = fakeOAuthDb.rows("oAuthAuthorizationRequest");
    expect(stored).toMatchObject({ id: outcome.view.requestId, userId: A, clientId: "client-a", state: "st4te", resource: CONFIG.resource });
    expect(stored.csrfTokenHash).toBe(createHash("sha256").update(outcome.view.csrfToken).digest("hex"));
    expect(JSON.stringify(stored)).not.toContain(outcome.view.csrfToken);
    expect(stored.expiresAt).toEqual(new Date(NOW.getTime() + 10 * 60 * 1000));
  });

  it.each([
    ["an unknown client", { client_id: "tpc_ZZZZZZZZZZZZZZZZZZZZZZ" }, "invalid_client"],
    ["another redirect URI (CA28)", { redirect_uri: "https://evil.example/cb" }, "invalid_redirect_uri"],
    ["another user's manual client (CA28)", { client_id: CLIENT_B }, "foreign_client"],
    ["no client", { client_id: undefined }, "invalid_request"],
    ["a repeated client_id", { client_id: [CLIENT_A, CLIENT_B] }, "invalid_request"],
  ])("shows an error page, without redirecting, for %s", async (_label, overrides, reason) => {
    await expect(prepareAuthorization(CONFIG, A, params(overrides), NOW)).resolves.toEqual({ kind: "error", reason });
    expect(fakeOAuthDb.rows("oAuthAuthorizationRequest")).toHaveLength(0);
  });

  it.each([
    ["without PKCE (CA3)", { code_challenge: undefined }, "invalid_request"],
    ["with plain PKCE", { code_challenge_method: "plain" }, "invalid_request"],
    ["with another response type", { response_type: "token" }, "unsupported_response_type"],
    ["for another resource", { resource: "https://staging.example.com/api/mcp" }, "invalid_target"],
    ["with an unknown scope", { scope: "trips:read admin" }, "invalid_scope"],
    ["with only offline_access", { scope: "offline_access" }, "invalid_scope"],
  ])("sends the client back with the error, state and iss %s", async (_label, overrides, error) => {
    const outcome = await prepareAuthorization(CONFIG, A, params(overrides), NOW);
    expect(outcome.kind).toBe("redirect");
    if (outcome.kind !== "redirect") return;
    const url = new URL(outcome.location);
    expect(url.origin + url.pathname).toBe(REDIRECT);
    expect(Object.fromEntries(url.searchParams)).toEqual({ error, state: "st4te", iss: CONFIG.issuer });
    expect(fakeOAuthDb.rows("oAuthAuthorizationRequest")).toHaveLength(0);
  });

  it.each([
    ["with another response type", { response_type: "x" }, "unsupported_response_type"],
    ["without PKCE", { code_challenge: undefined }, "invalid_request"],
    ["with an unknown scope", { scope: "admin" }, "invalid_scope"],
  ])("doesn't send a CIMD client back on its own %s: its redirect URI is the publisher's (RFC 9700, 4.11.2)", async (_label, overrides, error) => {
    vi.mocked(fetchClientMetadata).mockResolvedValue({ name: "Phish", redirectUris: ["https://evil.example/phish"] });
    const outcome = await prepareAuthorization(
      CONFIG,
      A,
      params({ client_id: "https://evil.example/c.json", redirect_uri: "https://evil.example/phish", ...overrides }),
      NOW,
    );
    expect(outcome.kind).toBe("client_error");
    if (outcome.kind !== "client_error") return;
    expect(outcome.error).toBe(error);
    const url = new URL(outcome.location);
    expect(url.origin + url.pathname).toBe("https://evil.example/phish");
    expect(Object.fromEntries(url.searchParams)).toEqual({ error, state: "st4te", iss: CONFIG.issuer });
    expect(fakeOAuthDb.rows("oAuthClient")).toHaveLength(2);
    expect(fakeOAuthDb.rows("oAuthAuthorizationRequest")).toHaveLength(0);
  });

  it("stores a CIMD client only when the request passes every step", async () => {
    await prepareAuthorization(CONFIG, A, params({ client_id: CIMD_ID, code_challenge: undefined }), NOW);
    expect(fakeOAuthDb.rows("oAuthClient")).toHaveLength(2);

    const outcome = await prepareAuthorization(CONFIG, A, params({ client_id: CIMD_ID }), NOW);
    expect(outcome.kind).toBe("consent");
    expect(fakeOAuthDb.rows("oAuthClient").find((c) => c.clientId === CIMD_ID)).toMatchObject({ kind: "CIMD", name: "Paperclip" });
  });

  it("stops at ten active connections", async () => {
    fakeOAuthDb.rows("agentGrant").push(
      ...Array.from({ length: 10 }, (_, i) => ({
        id: `g${i}`,
        userId: A,
        clientId: "client-a",
        name: "",
        allTrips: false,
        scopes: [],
        createdAt: NOW,
        lastUsedAt: NOW,
        revokedAt: null,
        revokedReason: null,
      })),
    );
    await expect(prepareAuthorization(CONFIG, A, params(), NOW)).resolves.toEqual({ kind: "limit" });
    await expect(prepareAuthorization(CONFIG, B, params({ client_id: CLIENT_B }), NOW)).resolves.toMatchObject({ kind: "consent" });
  });
});

async function consentFor(userId: string, overrides: Record<string, string> = {}) {
  const outcome = await prepareAuthorization(CONFIG, userId, params({ client_id: userId === A ? CLIENT_A : CLIENT_B, ...overrides }), NOW);
  if (outcome.kind !== "consent") throw new Error(`no consent: ${outcome.kind}`);
  return outcome.view;
}

const allow = (view: { requestId: string; csrfToken: string }, extra: Record<string, unknown> = {}) => ({
  requestId: view.requestId,
  csrfToken: view.csrfToken,
  decision: "allow",
  ...extra,
});

describe("decideConsent", () => {
  it("creates the connection and a code, and sends the code back with state and iss (CA1)", async () => {
    const view = await consentFor(A);
    const result = await decideConsent(CONFIG, A, allow(view, { name: "Investigador", tripIds: ["trip-a1"], dives: "read", tripsWrite: "on" }), NOW);
    expect("location" in result).toBe(true);
    if (!("location" in result)) return;
    const url = new URL(result.location);
    expect(url.searchParams.get("code")).toMatch(/^tpac_/);
    expect(url.searchParams.get("state")).toBe("st4te");
    expect(url.searchParams.get("iss")).toBe(CONFIG.issuer);

    const [grant] = fakeOAuthDb.rows("agentGrant");
    expect(grant).toMatchObject({ userId: A, clientId: "client-a", name: "Investigador", allTrips: false });
    expect([...(grant.scopes as string[])].sort()).toEqual(["dives:read", "offline_access", "trips:read", "trips:write"]);
    expect(fakeOAuthDb.rows("agentGrantTrip")).toEqual([{ grantId: grant.id, tripId: "trip-a1" }]);
    const [code] = fakeOAuthDb.rows("oAuthCode");
    expect(code.codeHash).toBe(createHash("sha256").update(url.searchParams.get("code")!).digest("hex"));
    expect(code).toMatchObject({ redirectUri: REDIRECT, codeChallenge: CHALLENGE, expiresAt: new Date(NOW.getTime() + 60_000) });
    expect(fakeOAuthDb.rows("oAuthAuthorizationRequest")[0].consumedAt).toEqual(NOW);
  });

  it("never grants a scope the client didn't ask for", async () => {
    const view = await consentFor(A, { scope: "trips:read" });
    await decideConsent(CONFIG, A, allow(view, { tripsMode: "all", tripsWrite: "on", tripsDelete: "on", dives: "write", divesDelete: "on" }), NOW);
    expect(fakeOAuthDb.rows("agentGrant")[0]).toMatchObject({ scopes: ["trips:read"], allTrips: true });
  });

  it("names the connection after the client by default", async () => {
    await decideConsent(CONFIG, A, allow(await consentFor(A)), NOW);
    expect(fakeOAuthDb.rows("agentGrant")[0].name).toBe("Agente de A");
  });

  it.each([
    ["without the CSRF token (CA23)", (v: { csrfToken: string }) => ({ csrfToken: undefined }), "csrf"],
    ["with another CSRF token (CA23)", () => ({ csrfToken: "x".repeat(43) }), "csrf"],
  ])("refuses a submission %s, and nothing is created", async (_label, change, error) => {
    const view = await consentFor(A);
    await expect(decideConsent(CONFIG, A, { ...allow(view), ...change(view) }, NOW)).resolves.toEqual({ error });
    expect(fakeOAuthDb.rows("agentGrant")).toHaveLength(0);
    expect(fakeOAuthDb.rows("oAuthAuthorizationRequest")[0].consumedAt).toBeNull();
  });

  it("refuses a request already consumed: the conditional update gives 0", async () => {
    const view = await consentFor(A);
    const spy = vi.spyOn(fakeOAuthPrisma.oAuthAuthorizationRequest, "updateMany").mockResolvedValueOnce({ count: 0 });
    await expect(decideConsent(CONFIG, A, allow(view), NOW)).resolves.toEqual({ error: "expired" });
    expect(spy.mock.calls[0][0].where).toMatchObject({ id: view.requestId, userId: A, consumedAt: null, expiresAt: { gt: NOW } });
    expect(fakeOAuthDb.rows("agentGrant")).toHaveLength(0);
    expect(fakeOAuthDb.rows("oAuthCode")).toHaveLength(0);
    spy.mockRestore();
  });

  it("authorizes once: the second submission of the same request is refused", async () => {
    const view = await consentFor(A);
    const results = await Promise.all([decideConsent(CONFIG, A, allow(view), NOW), decideConsent(CONFIG, A, allow(view), NOW)]);
    expect(results.filter((r) => "location" in r)).toHaveLength(1);
    expect(fakeOAuthDb.rows("agentGrant")).toHaveLength(1);
  });

  it("refuses an expired request", async () => {
    const view = await consentFor(A);
    const later = new Date(NOW.getTime() + 11 * 60 * 1000);
    await expect(decideConsent(CONFIG, A, allow(view), later)).resolves.toEqual({ error: "expired" });
  });

  it("cancelling sends access_denied and consumes the request", async () => {
    const view = await consentFor(A);
    const result = await decideConsent(CONFIG, A, { ...allow(view), decision: "deny" }, NOW);
    expect("location" in result && new URL(result.location).searchParams.get("error")).toBe("access_denied");
    expect(fakeOAuthDb.rows("agentGrant")).toHaveLength(0);
    await expect(decideConsent(CONFIG, A, allow(view), NOW)).resolves.toEqual({ error: "expired" });
  });

  it("cancelling sends a CIMD client back too: it takes a click", async () => {
    const outcome = await prepareAuthorization(CONFIG, A, params({ client_id: CIMD_ID }), NOW);
    if (outcome.kind !== "consent") throw new Error(`no consent: ${outcome.kind}`);
    const result = await decideConsent(CONFIG, A, { ...allow(outcome.view), decision: "deny" }, NOW);
    expect("location" in result && new URL(result.location).searchParams.get("error")).toBe("access_denied");
  });

  it("refuses dives with delete but no access, and no access at all", async () => {
    const view = await consentFor(A, { scope: "dives:read dives:delete" });
    await expect(decideConsent(CONFIG, A, allow(view, { dives: "none", divesDelete: "on" }), NOW)).resolves.toEqual({ error: "no_scopes" });
  });

  it("refuses an over-long name or an unknown decision", async () => {
    const view = await consentFor(A);
    await expect(decideConsent(CONFIG, A, allow(view, { name: "x".repeat(61) }), NOW)).resolves.toEqual({ error: "invalid" });
    await expect(decideConsent(CONFIG, A, { ...allow(view), decision: "maybe" }, NOW)).resolves.toEqual({ error: "invalid" });
  });

  describe.each([
    [A, B],
    [B, A],
  ])("as %s, with the ids of %s", (me, other) => {
    it("can't use the other user's request", async () => {
      const theirs = await consentFor(other);
      await expect(decideConsent(CONFIG, me, allow(theirs), NOW)).resolves.toEqual({ error: "expired" });
      expect(fakeOAuthDb.rows("agentGrant")).toHaveLength(0);
    });

    it("can't put the other user's trip in the connection", async () => {
      const view = await consentFor(me);
      const theirTrip = other === A ? "trip-a1" : "trip-b1";
      await expect(decideConsent(CONFIG, me, allow(view, { tripIds: [theirTrip] }), NOW)).resolves.toEqual({ error: "invalid_trips" });
      expect(fakeOAuthDb.rows("agentGrant")).toHaveLength(0);
    });
  });
});
