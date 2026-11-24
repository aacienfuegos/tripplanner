import { prisma } from "@/lib/prisma";
import { NO_STORE, getOAuthConfig, notConfiguredResponse } from "@/lib/oauth/config";
import { revokeGrant } from "@/lib/oauth/grants";
import { readForm } from "@/lib/oauth/token-exchange";
import { secretHash } from "@/lib/oauth/tokens";

// RFC 7009. A token that doesn't exist or belongs to another client gets the
// same 200 and nothing happens, so the endpoint tells nobody what exists.
// Revoking a refresh token ends the connection with all its tokens (2.1).
export async function POST(request: Request): Promise<Response> {
  const config = getOAuthConfig();
  if (!config) return notConfiguredResponse();

  const params = await readForm(request);
  const token = params?.get("token");
  if (!params || !token) return Response.json({ error: "invalid_request" }, { status: 400, headers: NO_STORE });

  const tokenHash = secretHash(token);
  const clientId = params.get("client_id");
  try {
    const row = await prisma.oAuthToken.findUnique({
      where: { tokenHash },
      select: { kind: true, grantId: true, grant: { select: { client: { select: { clientId: true } } } } },
    });
    if (row && clientId && row.grant.client.clientId === clientId) {
      if (row.kind === "REFRESH") {
        const now = new Date();
        await prisma.$transaction((tx) => revokeGrant(tx, row.grantId, "USER", now));
      } else {
        await prisma.oAuthToken.deleteMany({ where: { tokenHash } });
      }
    }
  } catch (error) {
    console.error("[oauth/revoke] server_error", error instanceof Error ? error.name : typeof error);
    return Response.json({ error: "server_error" }, { status: 500, headers: NO_STORE });
  }
  return new Response(null, { status: 200, headers: NO_STORE });
}
