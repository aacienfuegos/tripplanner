// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SCOPES, type Scope } from "@/lib/services/actor";
import { availableTools } from "@/lib/mcp/server";
import { TOOLS } from "@/lib/mcp/tools";
import { ISSUER, mcpRequest, rpc, rpcBody, seedConnection } from "./helpers/mcp-client";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers/fake-oauth-db")).fakeOAuthPrisma }));

import { POST } from "@/app/api/mcp/route";

type ListedTool = {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: { type?: string };
  outputSchema?: { type?: string };
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean };
};

const GRANTABLE = SCOPES.filter((scope) => scope !== "offline_access");
const READ_PREFIXES = ["list_", "get_"];
const isRead = (name: string) => READ_PREFIXES.some((prefix) => name.startsWith(prefix));

function subsets(): Scope[][] {
  return Array.from({ length: 2 ** GRANTABLE.length }, (_, mask) => GRANTABLE.filter((_, i) => mask & (1 << i)));
}

function context(scopes: readonly Scope[], allTrips: boolean, mediaAdmin: boolean) {
  return {
    actor: {
      kind: "agent" as const,
      userId: "user-a",
      grant: { id: "grant-1", allTrips, tripIds: new Set<string>(), scopes: new Set(scopes) },
    },
    mediaAdmin,
  };
}

beforeEach(() => {
  vi.stubEnv("AUTH_URL", ISSUER);
  vi.stubEnv("MEDIA_LIBRARY_PATH", "/media");
  vi.stubEnv("JELLYFIN_URL", "https://jellyfin.example.com");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("which tools a connection gets (CA5, CA10, CA13)", () => {
  it.each([false, true])("with every combination of scopes (all trips: %s)", (allTrips) => {
    const order = TOOLS.map((tool) => tool.name);
    for (const scopes of subsets()) {
      for (const mediaAdmin of [false, true]) {
        const names = availableTools(context(scopes, allTrips, mediaAdmin)).map((tool) => tool.name);
        const has = (scope: Scope) => scopes.includes(scope);

        for (const tool of TOOLS) {
          const expected =
            has(tool.scope) && (!tool.allTripsOnly || allTrips) && (!tool.mediaAdminOnly || mediaAdmin);
          expect(names.includes(tool.name), `${tool.name} with ${scopes.join(" ")}`).toBe(expected);
        }
        if (!has("dives:read")) expect(names.filter((name) => name.includes("dive"))).toEqual([]);
        if (!has("trips:write")) expect(names.filter((name) => /^(create|update)_(trip|accommodation)$/.test(name))).toEqual([]);
        // Always the catalog's order.
        expect(names).toEqual(order.filter((name) => names.includes(name)));
      }
    }
  });

  it("no tool deletes a trip or a dive, and none deletes anything yet", () => {
    expect(TOOLS.filter((tool) => tool.name.startsWith("delete_"))).toEqual([]);
  });

  it("every tool has a snake_case name and a scope of the catalog", () => {
    for (const tool of TOOLS) {
      expect(tool.name).toMatch(/^[a-z]+(_[a-z]+)*$/);
      expect(SCOPES).toContain(tool.scope);
    }
    expect(new Set(TOOLS.map((tool) => tool.name)).size).toBe(TOOLS.length);
  });
});

describe("tools/list through the SDK (CA11)", () => {
  async function listed(scopes: readonly string[], options: { allTrips?: boolean; isAdmin?: boolean } = {}) {
    const token = seedConnection({ scopes, allTrips: options.allTrips, isAdmin: options.isAdmin });
    const response = await POST(mcpRequest(token, rpc("tools/list")));
    expect(response.status).toBe(200);
    return ((await rpcBody(response)).result as { tools: ListedTool[] }).tools;
  }

  it("publishes the whole catalog with title, description, both schemas and annotations, in order", async () => {
    const tools = await listed(GRANTABLE, { allTrips: true, isAdmin: true });
    expect(tools.map((tool) => tool.name)).toEqual(TOOLS.map((tool) => tool.name));

    for (const tool of tools) {
      expect(tool.title, tool.name).toBeTruthy();
      expect(tool.description, tool.name).toBeTruthy();
      expect(tool.inputSchema?.type, tool.name).toBe("object");
      expect(tool.outputSchema?.type, tool.name).toBe("object");
      expect(tool.annotations, tool.name).toBeDefined();
      if (isRead(tool.name)) expect(tool.annotations?.readOnlyHint, tool.name).toBe(true);
      else expect(tool.annotations?.readOnlyHint, tool.name).toBe(false);
      if (tool.name.startsWith("delete_")) expect(tool.annotations?.destructiveHint, tool.name).toBe(true);
      else if (!isRead(tool.name)) expect(tool.annotations?.destructiveHint, tool.name).toBe(false);
      if (tool.name.startsWith("update_")) expect(tool.annotations?.idempotentHint, tool.name).toBe(true);
    }
  });

  it("without writing, without diving and with a list of trips, publishes only what it may call", async () => {
    const tools = await listed(["trips:read", "trips:write"]);
    const names = tools.map((tool) => tool.name);
    expect(names).toContain("create_accommodation");
    expect(names).not.toContain("create_trip");
    expect(names).not.toContain("update_trip");
    expect(names.filter((name) => name.includes("dive"))).toEqual([]);

    expect((await listed(["trips:read", "dives:read"])).map((tool) => tool.name)).not.toContain("list_dive_media");
  });
});
