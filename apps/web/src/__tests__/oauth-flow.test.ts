// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHash, randomBytes } from "node:crypto";
import { fakeOAuthDb } from "./helpers/fake-oauth-db";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/action-auth", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers/fake-oauth-db")).fakeOAuthPrisma }));
vi.mock("@/lib/oauth/cimd", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/oauth/cimd")>()),
  fetchClientMetadata: vi.fn(),
}));

import { requireUser } from "@/lib/action-auth";
import { fetchClientMetadata } from "@/lib/oauth/cimd";
import { createAgentClient, revokeAgentConnection } from "@/actions/agents";
import { getOAuthConfig } from "@/lib/oauth/config";
import { prepareAuthorization } from "@/lib/oauth/authorize";
import { decideConsent } from "@/lib/oauth/consent";
import { verifyAccessToken } from "@/lib/oauth/verify";
import { POST as token } from "@/app/api/oauth/token/route";

// A test MCP client doing the whole flow with PKCE, as the base of CA1 (the
// MCP call itself comes with /api/mcp in phase 3).

const ISSUER = "https://trips.example.com";
const USER = "user-a";
const CALLBACK = "https://agent.example.com/callback";
const CIMD_ID = "https://agent.example.com/oauth/client.json";

type Tokens = { access_token: string; refresh_token: string; scope: string };

async function tokenCall(params: Record<string, string>) {
  return token(
    new Request(`${ISSUER}/api/oauth/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "cf-connecting-ip": randomBytes(4).join(".") },
      body: new URLSearchParams(params).toString(),
    }),
  );
}

async function runFlow(clientId: string): Promise<{ tokens: Tokens; grantId: string; secrets: string[] }> {
  const config = getOAuthConfig()!;
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const state = randomBytes(8).toString("hex");

  const outcome = await prepareAuthorization(config, USER, {
    response_type: "code",
    client_id: clientId,
    redirect_uri: CALLBACK,
    code_challenge: challenge,
    code_challenge_method: "S256",
    scope: "trips:read trips:write dives:read offline_access",
    state,
    resource: config.resource,
  });
  if (outcome.kind !== "consent") throw new Error(`expected the consent screen, got ${outcome.kind}`);

  const consent = await decideConsent(config, USER, {
    requestId: outcome.view.requestId,
    csrfToken: outcome.view.csrfToken,
    decision: "allow",
    name: "Investigador",
    tripIds: ["trip-1"],
    dives: "read",
    tripsWrite: "on",
  });
  if (!("location" in consent)) throw new Error(`consent failed: ${consent.error}`);
  const back = new URL(consent.location);
  expect(back.origin + back.pathname).toBe(CALLBACK);
  expect(back.searchParams.get("state")).toBe(state);
  expect(back.searchParams.get("iss")).toBe(ISSUER);
  const code = back.searchParams.get("code")!;

  const exchanged = await tokenCall({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    redirect_uri: CALLBACK,
    code_verifier: verifier,
    resource: config.resource,
  });
  expect(exchanged.status).toBe(200);
  const first = (await exchanged.json()) as Tokens;
  expect(first.scope.split(" ").sort()).toEqual(["dives:read", "offline_access", "trips:read", "trips:write"]);

  const refreshed = await tokenCall({ grant_type: "refresh_token", refresh_token: first.refresh_token, client_id: clientId });
  expect(refreshed.status).toBe(200);
  const tokens = (await refreshed.json()) as Tokens;

  const grantId = fakeOAuthDb.rows("agentGrant").at(-1)!.id as string;
  return { tokens, grantId, secrets: [code, verifier, outcome.view.csrfToken, first.access_token, first.refresh_token, tokens.access_token, tokens.refresh_token] };
}

beforeEach(() => {
  vi.stubEnv("AUTH_URL", ISSUER);
  vi.mocked(requireUser).mockResolvedValue(USER);
  vi.mocked(fetchClientMetadata).mockResolvedValue({ name: "Paperclip", redirectUris: [CALLBACK] });
  fakeOAuthDb.reset({
    user: [{ id: USER }],
    trip: [{ id: "trip-1", userId: USER, name: "Japón" }],
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

async function manualClientId(): Promise<string> {
  await expect(createAgentClient({ name: "Agente de prueba", redirectUri: CALLBACK })).resolves.toEqual({ ok: true });
  return fakeOAuthDb.rows("oAuthClient")[0].clientId as string;
}

describe.each([
  ["a manually registered client", manualClientId],
  ["a CIMD client", async () => CIMD_ID],
])("the whole flow with %s (CA1)", (_label, clientId) => {
  it("authorizes, exchanges, refreshes and, once revoked, the refresh fails", async () => {
    const id = await clientId();
    const { tokens, grantId, secrets } = await runFlow(id);

    const config = getOAuthConfig()!;
    const verified = await verifyAccessToken(config, tokens.access_token);
    expect(verified).toMatchObject({ userId: USER, clientId: id });
    expect([...verified!.grant.tripIds]).toEqual(["trip-1"]);

    const stored = JSON.stringify(fakeOAuthDb.dump());
    for (const secret of secrets) expect(stored).not.toContain(secret);
    expect(fakeOAuthDb.rows("agentGrant").find((g) => g.id === grantId)).toMatchObject({ name: "Investigador", allTrips: false });

    await expect(revokeAgentConnection(grantId)).resolves.toEqual({ ok: true });
    const afterRevoke = await tokenCall({ grant_type: "refresh_token", refresh_token: tokens.refresh_token, client_id: id });
    expect(afterRevoke.status).toBe(400);
    expect(await afterRevoke.json()).toEqual({ error: "invalid_grant" });
    await expect(verifyAccessToken(config, tokens.access_token)).resolves.toBeNull();
  });
});
