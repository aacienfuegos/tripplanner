import { handleMcpPost } from "@/lib/mcp/server";

// The order of the checks is in lib/mcp/server.ts: 503 without an issuer,
// Origin, token in the query, bearer token, limit per connection, scopes of
// the tool, and only then the SDK.
export function POST(request: Request): Promise<Response> {
  return handleMcpPost(request);
}

// Without state there is no stream to open nor session to close.
function methodNotAllowed(): Response {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}

export const GET = methodNotAllowed;
export const DELETE = methodNotAllowed;
