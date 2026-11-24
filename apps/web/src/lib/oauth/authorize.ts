import "server-only";
import { prisma } from "@/lib/prisma";
import type { Scope } from "@/lib/services/actor";
import {
  AUTHORIZATION_REQUEST_TTL_MS,
  MAX_ACTIVE_GRANTS,
  isScope,
  withImpliedScopes,
  type OAuthConfig,
} from "@/lib/oauth/config";
import { resolveClient, saveClient, type KnownClient } from "@/lib/oauth/clients";
import { countActiveGrants } from "@/lib/oauth/grants";
import { isCodeChallenge, randomToken, secretHash } from "@/lib/oauth/tokens";

export type AuthorizeParams = { readonly [key: string]: string | string[] | undefined };

// Errors shown on our own page: until the client and its redirect URI are
// known to match, nothing may be sent to that URI.
export type AuthorizeErrorPage = "not_approved" | "invalid_request" | "invalid_client" | "invalid_redirect_uri" | "foreign_client";

export type ConsentView = {
  readonly requestId: string;
  readonly csrfToken: string;
  readonly client: KnownClient;
  readonly redirectUri: string;
  readonly scopes: readonly Scope[];
};

export type AuthorizeOutcome =
  | { readonly kind: "error"; readonly reason: AuthorizeErrorPage }
  | { readonly kind: "redirect"; readonly location: string }
  | { readonly kind: "client_error"; readonly error: string; readonly location: string }
  | { readonly kind: "limit" }
  | { readonly kind: "consent"; readonly view: ConsentView };

// Undefined if absent, null if repeated.
function single(params: AuthorizeParams, key: string): string | null | undefined {
  const value = params[key];
  return Array.isArray(value) ? null : value;
}

// The response to the client: error or code, with state and iss (RFC 9207).
export function clientRedirect(
  config: OAuthConfig,
  redirectUri: string,
  state: string | null,
  result: { readonly code: string } | { readonly error: string },
): string {
  const url = new URL(redirectUri);
  if ("code" in result) url.searchParams.set("code", result.code);
  else url.searchParams.set("error", result.error);
  if (state) url.searchParams.set("state", state);
  url.searchParams.set("iss", config.issuer);
  return url.toString();
}

// The validation of "Servidor de autorización", in its order. The user is
// re-read from the database first: a PENDING user has a session, and nothing is
// fetched or stored for them. A CIMD document fetched here is stored only if
// the request passes all five steps.
export async function prepareAuthorization(
  config: OAuthConfig,
  userId: string,
  params: AuthorizeParams,
  now: Date = new Date(),
): Promise<AuthorizeOutcome> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
  if (user?.status !== "APPROVED") return { kind: "error", reason: "not_approved" };

  const clientId = single(params, "client_id");
  const redirectUri = single(params, "redirect_uri");
  if (!clientId || !redirectUri) return { kind: "error", reason: "invalid_request" };
  const client = await resolveClient(clientId, now);
  if (!client) return { kind: "error", reason: "invalid_client" };
  if (!client.redirectUris.includes(redirectUri)) return { kind: "error", reason: "invalid_redirect_uri" };
  if (client.kind === "MANUAL" && client.ownerUserId !== userId) return { kind: "error", reason: "foreign_client" };

  const state = single(params, "state");
  const validState = typeof state === "string" && state.length <= 1024 ? state : null;
  // Anyone can publish a CIMD document with their own redirect URI, so its
  // errors go back only after a click (RFC 9700, 4.11.2): otherwise this
  // page would be an open redirector. A manual client was registered by the
  // user, who trusts its URI.
  const back = (error: string): AuthorizeOutcome => {
    const location = clientRedirect(config, redirectUri, validState, { error });
    return client.kind === "CIMD" ? { kind: "client_error", error, location } : { kind: "redirect", location };
  };
  if (state === null || (state !== undefined && validState === null)) return back("invalid_request");

  const responseType = single(params, "response_type");
  if (responseType !== "code") return back(responseType ? "unsupported_response_type" : "invalid_request");
  const codeChallenge = single(params, "code_challenge");
  if (!codeChallenge || !isCodeChallenge(codeChallenge)) return back("invalid_request");
  if (single(params, "code_challenge_method") !== "S256") return back("invalid_request");
  const resource = single(params, "resource");
  if (resource === null || (resource !== undefined && resource !== config.resource)) return back("invalid_target");
  const scope = single(params, "scope");
  if (typeof scope !== "string") return back("invalid_scope");
  const asked = scope.split(" ").filter(Boolean);
  if (asked.length === 0 || !asked.every(isScope)) return back("invalid_scope");
  const scopes = withImpliedScopes(asked.filter(isScope));
  if (!scopes.has("trips:read") && !scopes.has("dives:read")) return back("invalid_scope");

  if ((await countActiveGrants(userId, now)) >= MAX_ACTIVE_GRANTS) return { kind: "limit" };

  const clientDbId = await saveClient(client, now);
  await prisma.oAuthAuthorizationRequest.deleteMany({ where: { expiresAt: { lt: now } } });
  const requestId = randomToken();
  const csrfToken = randomToken();
  await prisma.oAuthAuthorizationRequest.create({
    data: {
      id: requestId,
      userId,
      clientId: clientDbId,
      redirectUri,
      codeChallenge,
      state: validState,
      resource: config.resource,
      requestedScopes: [...scopes],
      csrfTokenHash: secretHash(csrfToken),
      expiresAt: new Date(now.getTime() + AUTHORIZATION_REQUEST_TTL_MS),
    },
  });
  return { kind: "consent", view: { requestId, csrfToken, client: { ...client, id: clientDbId }, redirectUri, scopes: [...scopes] } };
}
