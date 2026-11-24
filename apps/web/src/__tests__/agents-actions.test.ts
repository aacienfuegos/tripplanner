// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeOAuthDb } from "./helpers/fake-oauth-db";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/action-auth", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers/fake-oauth-db")).fakeOAuthPrisma }));

import { requireUser } from "@/lib/action-auth";
import { createAgentClient, deleteAgentClient, revokeAgentConnection } from "@/actions/agents";
import { countActiveGrants, listManualClients, listUserGrants } from "@/lib/oauth/grants";
import { decideConsent } from "@/lib/oauth/consent";
import { secretHash } from "@/lib/oauth/tokens";

const A = "user-a";
const B = "user-b";
const DAY = 24 * 60 * 60 * 1000;
const CONFIG = { issuer: "https://trips.example.com", resource: "https://trips.example.com/api/mcp" };

function grant(id: string, userId: string, clientId: string, extra: Record<string, unknown> = {}) {
  return { id, userId, clientId, name: id, allTrips: true, scopes: ["trips:read"], lastUsedAt: new Date(), ...extra };
}

function seed() {
  fakeOAuthDb.reset({
    user: [{ id: A }, { id: B }],
    oAuthClient: [
      { id: `client-${A}`, clientId: "tpc_AAAAAAAAAAAAAAAAAAAAAA", name: "de A", ownerUserId: A, redirectUris: ["https://a.example/cb"] },
      { id: `client-${B}`, clientId: "tpc_BBBBBBBBBBBBBBBBBBBBBB", name: "de B", ownerUserId: B, redirectUris: ["https://b.example/cb"] },
    ],
    agentGrant: [grant(`grant-${A}`, A, `client-${A}`), grant(`grant-${B}`, B, `client-${B}`)],
    oAuthToken: [A, B].map((u) => ({
      tokenHash: `hash-${u}`,
      kind: "REFRESH",
      grantId: `grant-${u}`,
      resource: CONFIG.resource,
      expiresAt: new Date(Date.now() + DAY),
    })),
  });
}

const grantOf = (id: string) => fakeOAuthDb.rows("agentGrant").find((g) => g.id === id);
const tokensOf = (grantId: string) => fakeOAuthDb.rows("oAuthToken").filter((t) => t.grantId === grantId);

beforeEach(seed);

describe.each([
  [A, B],
  [B, A],
])("as %s, with the ids of %s", (me, other) => {
  beforeEach(() => {
    vi.mocked(requireUser).mockResolvedValue(me);
  });

  it("revokes the user's own connection and deletes its tokens (CA16)", async () => {
    await expect(revokeAgentConnection(`grant-${me}`)).resolves.toEqual({ ok: true });
    expect(grantOf(`grant-${me}`)).toMatchObject({ revokedReason: "USER" });
    expect(tokensOf(`grant-${me}`)).toHaveLength(0);
  });

  it("can't revoke the other user's connection: not found, and its tokens stay", async () => {
    await expect(revokeAgentConnection(`grant-${other}`)).resolves.toEqual({ ok: false, error: "not_found" });
    expect(grantOf(`grant-${other}`)).toMatchObject({ revokedAt: null });
    expect(tokensOf(`grant-${other}`)).toHaveLength(1);
  });

  it("deleting the user's client revokes its connections (CA28); the other user's is not found", async () => {
    await expect(deleteAgentClient(`client-${other}`)).resolves.toEqual({ ok: false, error: "not_found" });
    expect(grantOf(`grant-${other}`)).toMatchObject({ revokedAt: null });

    await expect(deleteAgentClient(`client-${me}`)).resolves.toEqual({ ok: true });
    expect(grantOf(`grant-${me}`)).toMatchObject({ revokedReason: "CLIENT_DELETED" });
    expect(tokensOf(`grant-${me}`)).toHaveLength(0);
    expect(await listManualClients(me)).toHaveLength(0);
  });

  it("registers clients for the user of the session, up to five", async () => {
    for (let i = 0; i < 4; i++) {
      await expect(createAgentClient({ name: `c${i}`, redirectUri: "https://x.example/cb" })).resolves.toEqual({ ok: true });
    }
    await expect(createAgentClient({ name: "c5", redirectUri: "https://x.example/cb" })).resolves.toEqual({ ok: false, error: "limit" });
    expect(await listManualClients(me)).toHaveLength(5);
    expect(await listManualClients(other)).toHaveLength(1);
    expect(fakeOAuthDb.rows("oAuthClient").filter((c) => c.ownerUserId === me)).toHaveLength(5);
  });

  it("rejects a client with an http URI that is not localhost, a wildcard or a fragment (CA28)", async () => {
    for (const redirectUri of ["http://x.example/cb", "https://*.x.example/cb", "https://x.example/cb#f"]) {
      await expect(createAgentClient({ name: "c", redirectUri })).resolves.toEqual({ ok: false, error: "invalid_redirect_uri" });
    }
    await expect(createAgentClient({ name: "", redirectUri: "https://x.example/cb" })).resolves.toEqual({ ok: false, error: "invalid_name" });
  });

  it("the Connections tab and the counter see only the user's connections", async () => {
    expect((await listUserGrants(me)).map((g) => g.id)).toEqual([`grant-${me}`]);
    expect(await countActiveGrants(me, new Date())).toBe(1);
  });

  it("the counter leaves out a connection 90 days unused, and the list shows it (CA16)", async () => {
    grantOf(`grant-${me}`)!.lastUsedAt = new Date(Date.now() - 91 * DAY);
    expect(await countActiveGrants(me, new Date())).toBe(0);
    expect(await listUserGrants(me)).toHaveLength(1);
    expect(await countActiveGrants(other, new Date())).toBe(1);
  });

  it("a consent over ten active connections is refused, and the other user's don't count", async () => {
    fakeOAuthDb.rows("agentGrant").push(...Array.from({ length: 9 }, (_, i) => grant(`extra-${i}`, me, `client-${me}`)));
    const csrf = "c".repeat(43);
    const request = (id: string, userId: string) => ({
      id,
      userId,
      clientId: `client-${userId}`,
      redirectUri: `https://${userId === A ? "a" : "b"}.example/cb`,
      codeChallenge: "x".repeat(43),
      resource: CONFIG.resource,
      requestedScopes: ["trips:read"],
      csrfTokenHash: secretHash(csrf),
      expiresAt: new Date(Date.now() + 60_000),
      state: null,
      consumedAt: null,
      createdAt: new Date(),
    });
    fakeOAuthDb.rows("oAuthAuthorizationRequest").push(request("req-me", me), request("req-other", other));
    await expect(decideConsent(CONFIG, me, { requestId: "req-me", csrfToken: csrf, decision: "allow" })).resolves.toEqual({ error: "limit" });
    await expect(decideConsent(CONFIG, other, { requestId: "req-other", csrfToken: csrf, decision: "allow" })).resolves.toHaveProperty("location");
  });
});
