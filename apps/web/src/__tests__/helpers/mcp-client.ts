import { randomBytes } from "node:crypto";
import { secretHash } from "@/lib/oauth/tokens";
import { fakeOAuthDb } from "./fake-oauth-db";

// A connection in the OAuth fake with a valid access token, and the requests
// an MCP client sends: 2025-11-25 over HTTP without a session, as Paperclip.

export const ISSUER = "https://trips.example.com";
export const MCP_URL = `${ISSUER}/api/mcp`;
export const RESOURCE_METADATA = `${ISSUER}/.well-known/oauth-protected-resource/api/mcp`;
export const USER = "user-a";

type Connection = {
  readonly grantId?: string;
  readonly scopes: readonly string[];
  readonly allTrips?: boolean;
  readonly tripIds?: readonly string[];
  readonly userStatus?: string;
  readonly lastUsedAt?: Date;
  readonly revokedAt?: Date | null;
  readonly resource?: string;
  readonly isAdmin?: boolean;
};

export function seedConnection({
  grantId = "grant-1",
  scopes,
  allTrips = false,
  tripIds = ["trip-1"],
  userStatus = "APPROVED",
  lastUsedAt = new Date(),
  revokedAt = null,
  resource = MCP_URL,
  isAdmin = false,
}: Connection): string {
  const token = `tpat_${randomBytes(32).toString("base64url")}`;
  fakeOAuthDb.reset({
    user: [{ id: USER, status: userStatus, isAdmin }],
    trip: [
      { id: "trip-1", userId: USER, name: "Japón", startDate: new Date("2026-04-01T00:00:00") },
      { id: "trip-2", userId: USER, name: "Islandia", startDate: new Date("2026-07-01T00:00:00") },
      { id: "trip-b", userId: "user-b", name: "De otro", startDate: new Date("2026-05-01T00:00:00") },
    ],
    oAuthClient: [{ id: "client-1", clientId: "tpc_prueba", ownerUserId: USER, name: "Prueba" }],
    agentGrant: [{ id: grantId, userId: USER, clientId: "client-1", name: "Investigador", allTrips, scopes: [...scopes], lastUsedAt, revokedAt }],
    agentGrantTrip: tripIds.map((tripId) => ({ grantId, tripId })),
    oAuthToken: [
      {
        tokenHash: secretHash(token),
        kind: "ACCESS",
        grantId,
        resource,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    ],
  });
  return token;
}

let requestId = 0;

export function rpc(method: string, params: Record<string, unknown> = {}) {
  return { jsonrpc: "2.0", id: ++requestId, method, params };
}

export function mcpRequest(
  token: string | null,
  body: unknown,
  { origin, url = MCP_URL }: { readonly origin?: string; readonly url?: string } = {},
): Request {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    "mcp-protocol-version": "2025-11-25",
  };
  if (token !== null) headers.authorization = `Bearer ${token}`;
  if (origin) headers.origin = origin;
  return new Request(url, { method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body) });
}

// The SDK answers a 2025 request as one SSE event, or as plain JSON.
export async function rpcBody(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  const data = text.split("\n").find((line) => line.startsWith("data: "));
  return JSON.parse(data ? data.slice("data: ".length) : text) as Record<string, unknown>;
}

export type ToolResult = { readonly isError?: boolean; readonly structuredContent: Record<string, unknown> };

export async function toolResult(response: Response): Promise<ToolResult> {
  const body = await rpcBody(response);
  if (!body.result) throw new Error(`expected a result, got ${JSON.stringify(body)}`);
  return body.result as ToolResult;
}
