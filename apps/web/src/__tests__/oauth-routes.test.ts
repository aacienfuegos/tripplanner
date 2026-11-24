// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fakeOAuthDb } from "./helpers/fake-oauth-db";

vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));
// next-auth imports "next/server" without an extension, which Node's ESM
// resolution can't load outside Next; the actions only need its AuthError.
vi.mock("next-auth", () => ({ AuthError: class AuthError extends Error {} }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
}));
vi.mock("@/lib/auth", () => ({ auth: vi.fn(), signIn: vi.fn() }));
vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers/fake-oauth-db")).fakeOAuthPrisma }));

import { signIn } from "@/lib/auth";
import { POST as revoke } from "@/app/api/oauth/revoke/route";
import { GET as authorizationServer } from "@/app/.well-known/oauth-authorization-server/route";
import { GET as protectedResource } from "@/app/.well-known/oauth-protected-resource/route";
import { GET as protectedResourceMcp } from "@/app/.well-known/oauth-protected-resource/api/mcp/route";
import { devSignIn, githubSignIn, googleSignIn, resendSignIn } from "@/app/auth/signin/actions";
import { authConfig } from "@/lib/auth.config";
import { generateSecret, secretHash } from "@/lib/oauth/tokens";

const ISSUER = "https://trips.example.com";
const CLIENT = "tpc_AAAAAAAAAAAAAAAAAAAAAA";

beforeEach(() => {
  vi.stubEnv("AUTH_URL", ISSUER);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("metadata documents (CA3)", () => {
  it("publishes the authorization server, with S256, no registration and the eight scopes", async () => {
    const res = await authorizationServer();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      issuer: ISSUER,
      authorization_endpoint: `${ISSUER}/oauth/authorize`,
      token_endpoint: `${ISSUER}/api/oauth/token`,
      revocation_endpoint: `${ISSUER}/api/oauth/revoke`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      client_id_metadata_document_supported: true,
      authorization_response_iss_parameter_supported: true,
    });
    expect(body.scopes_supported).toHaveLength(8);
    expect(body.registration_endpoint).toBeUndefined();
  });

  it("publishes the protected resource at both paths", async () => {
    for (const handler of [protectedResource, protectedResourceMcp]) {
      expect(await (await handler()).json()).toEqual({
        resource: `${ISSUER}/api/mcp`,
        authorization_servers: [ISSUER],
        scopes_supported: expect.arrayContaining(["trips:read", "offline_access"]),
        bearer_methods_supported: ["header"],
      });
    }
  });

  it("takes the issuer from AUTH_URL and not from the request, and is off without https", async () => {
    vi.stubEnv("AUTH_URL", "https://staging.example.com");
    expect((await (await authorizationServer()).json()).issuer).toBe("https://staging.example.com");
    vi.stubEnv("AUTH_URL", "http://localhost:3000");
    expect((await authorizationServer()).status).toBe(503);
    expect((await protectedResource()).status).toBe(503);
  });
});

describe("POST /api/oauth/revoke (RFC 7009)", () => {
  const access = generateSecret("tpat_");
  const refresh = generateSecret("tprt_");

  beforeEach(() => {
    fakeOAuthDb.reset({
      oAuthClient: [{ id: "client-1", clientId: CLIENT }],
      agentGrant: [{ id: "grant-1", userId: "user-a", clientId: "client-1" }],
      oAuthToken: [
        { tokenHash: secretHash(access), kind: "ACCESS", grantId: "grant-1", resource: "r", expiresAt: new Date(Date.now() + 60_000) },
        { tokenHash: secretHash(refresh), kind: "REFRESH", grantId: "grant-1", resource: "r", expiresAt: new Date(Date.now() + 60_000) },
      ],
    });
  });

  const post = (params: Record<string, string>) =>
    revoke(
      new Request(`${ISSUER}/api/oauth/revoke`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(params).toString(),
      }),
    );

  it("deletes an access token of the same client, and only that one", async () => {
    expect((await post({ token: access, client_id: CLIENT })).status).toBe(200);
    expect(fakeOAuthDb.rows("oAuthToken").map((t) => t.kind)).toEqual(["REFRESH"]);
    expect(fakeOAuthDb.rows("agentGrant")[0].revokedAt).toBeNull();
  });

  it("a refresh token ends the connection with all its tokens", async () => {
    expect((await post({ token: refresh, client_id: CLIENT, token_type_hint: "refresh_token" })).status).toBe(200);
    expect(fakeOAuthDb.rows("oAuthToken")).toHaveLength(0);
    expect(fakeOAuthDb.rows("agentGrant")[0].revokedAt).not.toBeNull();
  });

  it("answers 200 and does nothing for another client's token or an unknown one", async () => {
    expect((await post({ token: access, client_id: "tpc_BBBBBBBBBBBBBBBBBBBBBB" })).status).toBe(200);
    expect((await post({ token: access })).status).toBe(200);
    expect((await post({ token: generateSecret("tpat_"), client_id: CLIENT })).status).toBe(200);
    expect(fakeOAuthDb.rows("oAuthToken")).toHaveLength(2);
  });

  it("needs the token", async () => {
    expect((await post({ client_id: CLIENT })).status).toBe(400);
  });
});

describe("authorized (proxy)", () => {
  const authorized = (loggedIn: boolean, path: string) =>
    authConfig.callbacks!.authorized!({
      auth: loggedIn ? ({ user: { id: "u" } } as never) : null,
      request: { nextUrl: new URL(`${ISSUER}${path}`) } as never,
    });

  it("sends the authorization request through sign-in and back", async () => {
    const res = (await authorized(false, "/oauth/authorize?client_id=tpc_x&state=s")) as Response;
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/auth/signin");
    expect(location.searchParams.get("callbackUrl")).toBe("/oauth/authorize?client_id=tpc_x&state=s");
  });

  it("keeps the plain redirect elsewhere, and lets a session through", async () => {
    const res = (await authorized(false, "/trips")) as Response;
    expect(new URL(res.headers.get("location")!).search).toBe("");
    expect(await authorized(true, "/oauth/authorize?client_id=x")).toBe(true);
  });
});

describe("sign-in actions", () => {
  const actions = [
    ["google", googleSignIn],
    ["github", githubSignIn],
    ["resend", resendSignIn],
    ["dev-credentials", devSignIn],
  ] as const;

  const form = (callbackUrl: string) => {
    const data = new FormData();
    data.set("callbackUrl", callbackUrl);
    data.set("email", "a@example.com");
    data.set("password", "x");
    return data;
  };

  beforeEach(() => vi.mocked(signIn).mockReset());

  describe.each(actions)("%s", (provider, action) => {
    it.each([
      "/dashboard/../admin",
      "//evil.example",
      "/\\evil.example",
      "https://evil.example/oauth/authorize?",
    ])("sends %s to the dashboard", async (callbackUrl) => {
      await action(form(callbackUrl));
      expect(signIn).toHaveBeenCalledWith(provider, expect.objectContaining({ redirectTo: "/dashboard" }));
    });

    it("comes back to the authorization request", async () => {
      await action(form("/oauth/authorize?client_id=tpc_x"));
      expect(signIn).toHaveBeenCalledWith(provider, expect.objectContaining({ redirectTo: "/oauth/authorize?client_id=tpc_x" }));
    });
  });
});
