// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeOAuthDb, rawQueries } from "./helpers/fake-oauth-db";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers/fake-oauth-db")).fakeOAuthPrisma }));
vi.mock("@/lib/oauth/cimd", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/oauth/cimd")>()),
  fetchClientMetadata: vi.fn(),
}));

import { CimdError, fetchClientMetadata } from "@/lib/oauth/cimd";
import { createManualClient, resolveClient, saveClient } from "@/lib/oauth/clients";
import { countActiveGrants, deleteManualClient, listManualClients, listUserGrants, revokeUserGrant } from "@/lib/oauth/grants";

const A = "user-a";
const B = "user-b";
const NOW = new Date("2026-11-24T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const CIMD_ID = "https://agents.example.com/oauth/client.json";

function seed() {
  const forUser = (u: string) => ({
    client: {
      id: `client-${u}`,
      clientId: `tpc_${u.padEnd(22, "x")}`,
      kind: "MANUAL",
      name: `Cliente ${u}`,
      redirectUris: ["https://app.example.com/cb"],
      ownerUserId: u,
      createdAt: new Date("2026-01-01T00:00:00Z"),
    },
    grant: { id: `grant-${u}`, userId: u, clientId: `client-${u}`, name: `Conexión ${u}`, lastUsedAt: NOW },
    tokens: [
      { tokenHash: `access-${u}`, kind: "ACCESS", grantId: `grant-${u}`, resource: "r", expiresAt: new Date(NOW.getTime() + 3600_000) },
      { tokenHash: `refresh-${u}`, kind: "REFRESH", grantId: `grant-${u}`, resource: "r", expiresAt: new Date(NOW.getTime() + DAY) },
    ],
  });
  const a = forUser(A);
  const b = forUser(B);
  fakeOAuthDb.reset({
    user: [{ id: A }, { id: B }],
    oAuthClient: [a.client, b.client],
    agentGrant: [a.grant, b.grant],
    oAuthToken: [...a.tokens, ...b.tokens],
    oAuthCode: [{ codeHash: `code-${A}`, grantId: `grant-${A}`, redirectUri: "x", codeChallenge: "x", resource: "r", expiresAt: NOW }],
  });
}

beforeEach(() => {
  seed();
  vi.mocked(fetchClientMetadata).mockReset();
});

describe("resolveClient", () => {
  it("finds a manual client by its client_id, and not once it is deleted", async () => {
    const clientId = `tpc_${A.padEnd(22, "x")}`;
    await expect(resolveClient(clientId, NOW)).resolves.toMatchObject({ id: `client-${A}`, ownerUserId: A, kind: "MANUAL" });
    await deleteManualClient(A, `client-${A}`, NOW);
    await expect(resolveClient(clientId, NOW)).resolves.toBeNull();
  });

  it("knows nothing of an unknown or malformed client_id, and does not fetch it", async () => {
    await expect(resolveClient("tpc_" + "z".repeat(22), NOW)).resolves.toBeNull();
    await expect(resolveClient("../../etc", NOW)).resolves.toBeNull();
    await expect(resolveClient("http://agents.example.com/c.json", NOW)).resolves.toBeNull();
    expect(fetchClientMetadata).not.toHaveBeenCalled();
  });

  it("fetches a CIMD document and leaves it unsaved until the request passes", async () => {
    vi.mocked(fetchClientMetadata).mockResolvedValue({ name: "Paperclip", redirectUris: ["https://agents.example.com/cb"] });
    const client = await resolveClient(CIMD_ID, NOW);
    expect(client).toMatchObject({ id: null, kind: "CIMD", name: "Paperclip", ownerUserId: null });
    expect(fakeOAuthDb.rows("oAuthClient")).toHaveLength(2);

    const id = await saveClient(client!, NOW);
    expect(fakeOAuthDb.rows("oAuthClient").find((c) => c.id === id)).toMatchObject({ clientId: CIMD_ID, kind: "CIMD", metadataFetchedAt: NOW });
  });

  it("reuses a stored document for 24 hours and fetches it again after", async () => {
    vi.mocked(fetchClientMetadata).mockResolvedValue({ name: "Nuevo", redirectUris: ["https://agents.example.com/cb2"] });
    fakeOAuthDb.rows("oAuthClient").push({
      id: "client-cimd",
      clientId: CIMD_ID,
      kind: "CIMD",
      name: "Paperclip",
      redirectUris: ["https://agents.example.com/cb"],
      ownerUserId: null,
      metadataFetchedAt: new Date(NOW.getTime() - DAY + 1000),
      createdAt: NOW,
      deletedAt: null,
    });
    await expect(resolveClient(CIMD_ID, NOW)).resolves.toMatchObject({ id: "client-cimd", name: "Paperclip" });
    expect(fetchClientMetadata).not.toHaveBeenCalled();

    const later = new Date(NOW.getTime() + 2000);
    const refreshed = await resolveClient(CIMD_ID, later);
    expect(refreshed).toMatchObject({ id: null, name: "Nuevo" });
    await saveClient(refreshed!, later);
    expect(fakeOAuthDb.rows("oAuthClient").find((c) => c.id === "client-cimd")).toMatchObject({ name: "Nuevo", metadataFetchedAt: later });
  });

  it("gives null when the document is rejected", async () => {
    vi.mocked(fetchClientMetadata).mockRejectedValue(new CimdError("blocked_address"));
    await expect(resolveClient(CIMD_ID, NOW)).resolves.toBeNull();
  });
});

describe.each([
  [A, B],
  [B, A],
])("as %s, with the ids of %s", (me, other) => {
  it("registers a manual client with an https URI and lists it (CA28)", async () => {
    const result = await createManualClient(me, { name: " Mi agente ", redirectUri: "https://agent.example.com/cb" });
    expect(result).toMatchObject({ ok: true, clientId: expect.stringMatching(/^tpc_/) });
    const mine = await listManualClients(me);
    expect(mine.map((c) => c.name)).toEqual(["Mi agente", `Cliente ${me}`]);
    expect((await listManualClients(other)).map((c) => c.name)).toEqual([`Cliente ${other}`]);
    expect(rawQueries.some((q) => q.includes("FOR UPDATE"))).toBe(true);
  });

  it.each(["http://agent.example.com/cb", "https://*.example.com/cb", "https://agent.example.com/cb#x"])(
    "rejects the redirect URI %s (CA28)",
    async (redirectUri) => {
      await expect(createManualClient(me, { name: "x", redirectUri })).resolves.toEqual({ ok: false, error: "invalid_redirect_uri" });
    },
  );

  it("allows five clients per user, not counting the other user's", async () => {
    for (let i = 0; i < 4; i++) {
      expect((await createManualClient(me, { name: `c${i}`, redirectUri: "https://a.example.com/cb" })).ok).toBe(true);
    }
    await expect(createManualClient(me, { name: "sexto", redirectUri: "https://a.example.com/cb" })).resolves.toEqual({ ok: false, error: "limit" });
    expect((await listManualClients(other)).length).toBe(1);
  });

  it("deleting a client revokes its connections and deletes their tokens; someone else's is not found", async () => {
    await expect(deleteManualClient(me, `client-${other}`, NOW)).resolves.toBe(false);
    expect(fakeOAuthDb.rows("agentGrant").find((g) => g.id === `grant-${other}`)).toMatchObject({ revokedAt: null });
    expect(fakeOAuthDb.rows("oAuthToken").filter((t) => t.grantId === `grant-${other}`)).toHaveLength(2);

    await expect(deleteManualClient(me, `client-${me}`, NOW)).resolves.toBe(true);
    expect(fakeOAuthDb.rows("agentGrant").find((g) => g.id === `grant-${me}`)).toMatchObject({ revokedAt: NOW, revokedReason: "CLIENT_DELETED" });
    expect(fakeOAuthDb.rows("oAuthToken").filter((t) => t.grantId === `grant-${me}`)).toHaveLength(0);
    expect(fakeOAuthDb.rows("oAuthToken").filter((t) => t.grantId === `grant-${other}`)).toHaveLength(2);
  });

  it("revokes only the user's own connection, and deletes its tokens", async () => {
    await expect(revokeUserGrant(me, `grant-${other}`, NOW)).resolves.toBe(false);
    expect(fakeOAuthDb.rows("oAuthToken").filter((t) => t.grantId === `grant-${other}`)).toHaveLength(2);

    await expect(revokeUserGrant(me, `grant-${me}`, NOW)).resolves.toBe(true);
    expect(fakeOAuthDb.rows("agentGrant").find((g) => g.id === `grant-${me}`)).toMatchObject({ revokedReason: "USER" });
    expect(fakeOAuthDb.rows("oAuthToken").filter((t) => t.grantId === `grant-${me}`)).toHaveLength(0);
    expect(fakeOAuthDb.rows("oAuthCode").filter((c) => c.grantId === `grant-${me}`)).toHaveLength(0);
    await expect(revokeUserGrant(me, `grant-${me}`, NOW)).resolves.toBe(false);
  });

  it("lists and counts only the user's connections; the counter leaves out revoked and inactive ones", async () => {
    expect((await listUserGrants(me)).map((g) => g.id)).toEqual([`grant-${me}`]);
    expect(await countActiveGrants(me, NOW)).toBe(1);
    fakeOAuthDb.rows("agentGrant").push({
      id: "old",
      userId: me,
      clientId: `client-${me}`,
      name: "vieja",
      allTrips: false,
      scopes: [],
      createdAt: NOW,
      lastUsedAt: new Date(NOW.getTime() - 91 * DAY),
      revokedAt: null,
      revokedReason: null,
    });
    expect(await countActiveGrants(me, NOW)).toBe(1);
    await revokeUserGrant(me, `grant-${me}`, NOW);
    expect(await countActiveGrants(me, NOW)).toBe(0);
    expect(await countActiveGrants(other, NOW)).toBe(1);
  });
});
