import { NO_STORE, getOAuthConfig, notConfiguredResponse, type OAuthConfig } from "@/lib/oauth/config";
import {
  exchangeCode,
  readForm,
  rotateRefreshToken,
  type TokenErrorCode,
  type TokenResult,
} from "@/lib/oauth/token-exchange";
import { RateLimiter, clientIp, tooManyRequests } from "@/lib/rate-limit";

// Every request counts against its IP. Against its client, only the failed
// ones, and only after the credential has been checked: a valid code or
// refresh token always gets its tokens, so a stranger who knows a public
// client_id can't lock its owner out.
const perIp = new RateLimiter(20, 60_000);
const failuresPerClient = new RateLimiter(60, 60_000);

function tokenError(error: TokenErrorCode): Response {
  return Response.json({ error }, { status: error === "invalid_client" ? 401 : 400, headers: NO_STORE });
}

async function handle(config: OAuthConfig, params: URLSearchParams, now: Date): Promise<TokenResult> {
  const clientId = params.get("client_id");
  const resource = params.get("resource");
  switch (params.get("grant_type")) {
    case "authorization_code": {
      const code = params.get("code");
      const redirectUri = params.get("redirect_uri");
      const codeVerifier = params.get("code_verifier");
      if (!code || !clientId || !redirectUri || !codeVerifier) return { ok: false, error: "invalid_request" };
      return exchangeCode(config, { code, clientId, redirectUri, codeVerifier, resource }, now);
    }
    case "refresh_token": {
      const refreshToken = params.get("refresh_token");
      if (!refreshToken || !clientId) return { ok: false, error: "invalid_request" };
      return rotateRefreshToken(config, { refreshToken, clientId, resource }, now);
    }
    case null:
      return { ok: false, error: "invalid_request" };
    default:
      return { ok: false, error: "unsupported_grant_type" };
  }
}

export async function POST(request: Request): Promise<Response> {
  const config = getOAuthConfig();
  if (!config) return notConfiguredResponse();

  const ipLimit = perIp.hit(clientIp(request.headers));
  if (ipLimit.limited) return tooManyRequests(ipLimit.retryAfterSeconds, NO_STORE);

  const params = await readForm(request);
  if (!params) return tokenError("invalid_request");

  let result: TokenResult;
  try {
    result = await handle(config, params, new Date());
  } catch (error) {
    // The class only: a message could carry what the request sent.
    console.error("[oauth/token] server_error", error instanceof Error ? error.name : typeof error);
    return Response.json({ error: "server_error" }, { status: 500, headers: NO_STORE });
  }
  if (result.ok) return Response.json(result.body, { headers: NO_STORE });

  const clientId = params.get("client_id");
  if (clientId) {
    const clientLimit = failuresPerClient.peek(clientId);
    failuresPerClient.record(clientId);
    if (clientLimit.limited) return tooManyRequests(clientLimit.retryAfterSeconds, NO_STORE);
  }
  return tokenError(result.error);
}
