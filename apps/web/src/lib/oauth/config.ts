import { SCOPES, type Scope } from "@/lib/services/actor";

export const CODE_TTL_MS = 60 * 1000;
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
export const REFRESH_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;
export const AUTHORIZATION_REQUEST_TTL_MS = 10 * 60 * 1000;
export const INACTIVITY_MS = 90 * 24 * 60 * 60 * 1000;
export const LAST_USED_GRANULARITY_MS = 5 * 60 * 1000;
export const MAX_ACTIVE_GRANTS = 10;
export const MAX_MANUAL_CLIENTS = 5;

export type OAuthConfig = { readonly issuer: string; readonly resource: string };

// The issuer is AUTH_URL, never the Host of the request: a forged Host would
// otherwise hand out metadata and tokens bound to someone else's origin.
export function getOAuthConfig(): OAuthConfig | null {
  const raw = process.env.AUTH_URL;
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  return { issuer: url.origin, resource: `${url.origin}/api/mcp` };
}

export function isScope(value: string): value is Scope {
  return (SCOPES as readonly string[]).includes(value);
}

// *:write and *:delete come with their *:read, and so does suggesting.
export function withImpliedScopes(scopes: Iterable<Scope>): Set<Scope> {
  const result = new Set(scopes);
  for (const scope of [...result]) {
    if (scope === "trips:write" || scope === "trips:delete" || scope === "trips:suggest") result.add("trips:read");
    if (scope === "dives:write" || scope === "dives:delete") result.add("dives:read");
  }
  return result;
}

export const NO_STORE = { "Cache-Control": "no-store", Pragma: "no-cache" } as const;

export function notConfiguredResponse(): Response {
  return Response.json({ error: "temporarily_unavailable" }, { status: 503, headers: NO_STORE });
}

// RFC 8414. No registration_endpoint: clients are registered by hand or by CIMD.
export function authorizationServerMetadata(config: OAuthConfig) {
  return {
    issuer: config.issuer,
    authorization_endpoint: `${config.issuer}/oauth/authorize`,
    token_endpoint: `${config.issuer}/api/oauth/token`,
    revocation_endpoint: `${config.issuer}/api/oauth/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    revocation_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [...SCOPES],
    client_id_metadata_document_supported: true,
    authorization_response_iss_parameter_supported: true,
  };
}

// RFC 9728.
export function protectedResourceMetadata(config: OAuthConfig) {
  return {
    resource: config.resource,
    authorization_servers: [config.issuer],
    scopes_supported: [...SCOPES],
    bearer_methods_supported: ["header"],
  };
}

export function metadataResponse(build: (config: OAuthConfig) => object): Response {
  const config = getOAuthConfig();
  if (!config) return notConfiguredResponse();
  return Response.json(build(config), { headers: { "Cache-Control": "public, max-age=3600" } });
}
