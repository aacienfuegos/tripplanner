// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fakeOAuthDb } from "./helpers/fake-oauth-db";
import { ISSUER, RESOURCE_METADATA, mcpRequest, rpc, rpcBody, seedConnection, toolResult } from "./helpers/mcp-client";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers/fake-oauth-db")).fakeOAuthPrisma }));

import { DELETE, GET, POST } from "@/app/api/mcp/route";

const trip = { name: "Japón otra vez", startDate: "2027-04-01", endDate: "2027-04-10" };
const listTools = () => rpc("tools/list");
const callTool = (name: string, args: Record<string, unknown>) => rpc("tools/call", { name, arguments: args });

beforeEach(() => {
  vi.stubEnv("AUTH_URL", ISSUER);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("/api/mcp before the SDK (CA3)", () => {
  it("answers 503 while the issuer isn't an https AUTH_URL", async () => {
    const token = seedConnection({ scopes: ["trips:read"] });
    vi.stubEnv("AUTH_URL", "http://trips.example.com");
    expect((await POST(mcpRequest(token, listTools()))).status).toBe(503);
  });

  it("answers GET and DELETE with 405: there is no session", () => {
    expect(GET().status).toBe(405);
    expect(DELETE().status).toBe(405);
  });

  it("without a token, 401 with resource_metadata and no error code", async () => {
    seedConnection({ scopes: ["trips:read"] });
    const response = await POST(mcpRequest(null, listTools()));
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe(`Bearer resource_metadata="${RESOURCE_METADATA}"`);
  });

  it("with an invented token, 401 invalid_token, and its value is in no log (CA25)", async () => {
    seedConnection({ scopes: ["trips:read"] });
    const logged: unknown[] = [];
    for (const level of ["log", "info", "warn", "error", "debug"] as const) {
      vi.spyOn(console, level).mockImplementation((...args: unknown[]) => void logged.push(...args));
    }
    const invented = `tpat_${"x".repeat(43)}`;

    const response = await POST(mcpRequest(invented, listTools()));

    expect(response.status).toBe(401);
    const challenge = response.headers.get("www-authenticate") ?? "";
    expect(challenge).toContain('error="invalid_token"');
    expect(challenge).toContain(`resource_metadata="${RESOURCE_METADATA}"`);
    expect(JSON.stringify(logged)).not.toContain(invented);
    expect(await response.text()).not.toContain(invented);
  });

  it("a token issued for another resource (staging) is no good here", async () => {
    const token = seedConnection({ scopes: ["trips:read"], resource: "https://staging.example.com/api/mcp" });
    expect((await POST(mcpRequest(token, listTools()))).status).toBe(401);
  });

  it("refuses a foreign Origin, and lets ours through", async () => {
    const token = seedConnection({ scopes: ["trips:read"] });
    expect((await POST(mcpRequest(token, listTools(), { origin: "https://evil.example" }))).status).toBe(403);
    expect((await POST(mcpRequest(token, listTools(), { origin: "http://trips.example.com" }))).status).toBe(403);
    expect((await POST(mcpRequest(token, listTools(), { origin: ISSUER }))).status).toBe(200);
  });

  it("refuses the token in the query, even with a good header", async () => {
    const token = seedConnection({ scopes: ["trips:read"] });
    const response = await POST(mcpRequest(token, listTools(), { url: `${ISSUER}/api/mcp?access_token=${token}` }));
    expect(response.status).toBe(400);
  });

  it("with a good token, tools/list answers with the tools", async () => {
    const token = seedConnection({ scopes: ["trips:read"] });
    const response = await POST(mcpRequest(token, listTools()));
    expect(response.status).toBe(200);
    const body = await rpcBody(response);
    const tools = (body.result as { tools: { name: string }[] }).tools.map((tool) => tool.name);
    expect(tools).toEqual(["list_trips", "get_trip"]);
  });
});

describe("a tool the connection can't use is refused before it runs (CA10, CA13)", () => {
  it("without trips:write, creating is 403 insufficient_scope with the missing scope, and nothing is created", async () => {
    const token = seedConnection({ scopes: ["trips:read", "dives:read"], allTrips: true });
    const response = await POST(mcpRequest(token, callTool("create_trip", trip)));

    expect(response.status).toBe(403);
    const challenge = response.headers.get("www-authenticate") ?? "";
    expect(challenge).toContain('error="insufficient_scope"');
    expect(challenge).toContain('scope="trips:write"');
    expect(challenge).toContain(`resource_metadata="${RESOURCE_METADATA}"`);
    expect(fakeOAuthDb.rows("trip")).toHaveLength(3);
  });

  it("a batch with one call it can't make is refused whole", async () => {
    const token = seedConnection({ scopes: ["trips:read"], allTrips: true });
    const response = await POST(mcpRequest(token, [callTool("list_trips", {}), callTool("create_trip", trip)]));
    expect(response.status).toBe(403);
    expect(fakeOAuthDb.rows("trip")).toHaveLength(3);
  });

  it("creating a trip with a list of trips is forbidden, and with all of them it works", async () => {
    const list = seedConnection({ scopes: ["trips:read", "trips:write"] });
    const refused = await POST(mcpRequest(list, callTool("create_trip", trip)));
    expect(refused.status).toBe(403);
    expect(refused.headers.get("www-authenticate")).toBeNull();
    expect(fakeOAuthDb.rows("trip")).toHaveLength(3);

    const all = seedConnection({ scopes: ["trips:read", "trips:write"], allTrips: true });
    const result = await toolResult(await POST(mcpRequest(all, callTool("create_trip", trip))));
    expect(result.isError).toBeUndefined();
    expect(fakeOAuthDb.rows("trip")).toHaveLength(4);
  });
});

describe("the state of the connection and of its user, on every call (CA16, CA17)", () => {
  it("a revoked connection gets 401", async () => {
    const token = seedConnection({ scopes: ["trips:read"], revokedAt: new Date() });
    expect((await POST(mcpRequest(token, listTools()))).status).toBe(401);
  });

  it("one 90 days without use gets 401, and is marked inactive", async () => {
    const token = seedConnection({ scopes: ["trips:read"], lastUsedAt: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000) });
    expect((await POST(mcpRequest(token, listTools()))).status).toBe(401);
    expect(fakeOAuthDb.rows("agentGrant")[0]).toMatchObject({ revokedReason: "INACTIVE" });
  });

  it.each(["PENDING", "DENIED"])("a %s user gets 401, and approving them again brings the connection back", async (status) => {
    const token = seedConnection({ scopes: ["trips:read"], userStatus: status });
    expect((await POST(mcpRequest(token, listTools()))).status).toBe(401);

    fakeOAuthDb.rows("user")[0].status = "APPROVED";
    expect((await POST(mcpRequest(token, listTools()))).status).toBe(200);
  });
});

describe("the limit per connection (CA18)", () => {
  it("past 120 calls a minute, 429 with the wait, and the call isn't processed", async () => {
    const token = seedConnection({ grantId: "grant-limit", scopes: ["trips:read", "trips:write"], allTrips: true });
    // Counted before the body is read, so cheap calls use it up.
    for (let i = 0; i < 120; i++) expect((await POST(mcpRequest(token, "{"))).status).toBe(400);

    const response = await POST(mcpRequest(token, callTool("create_trip", trip)));
    expect(response.status).toBe(429);
    expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(fakeOAuthDb.rows("trip")).toHaveLength(3);
  });
});
