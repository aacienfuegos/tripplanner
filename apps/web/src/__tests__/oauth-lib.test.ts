// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
import { createHash } from "node:crypto";
import { getOAuthConfig, withImpliedScopes } from "@/lib/oauth/config";
import { generateClientId, generateSecret, isCodeChallenge, secretHash, verifyPkce } from "@/lib/oauth/tokens";
import { safeCallbackUrl } from "@/lib/oauth/callback-url";
import { RateLimiter, clientIp } from "@/lib/rate-limit";
import { isAllowedRedirectUri, isLoopbackRedirect } from "@/lib/oauth/client-rules";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getOAuthConfig", () => {
  it("takes the issuer and the resource from an https AUTH_URL", () => {
    vi.stubEnv("AUTH_URL", "https://trips.example.com/");
    expect(getOAuthConfig()).toEqual({
      issuer: "https://trips.example.com",
      resource: "https://trips.example.com/api/mcp",
    });
  });

  it("is off without AUTH_URL or with one that is not https", () => {
    vi.stubEnv("AUTH_URL", "");
    expect(getOAuthConfig()).toBeNull();
    vi.stubEnv("AUTH_URL", "http://localhost:3000");
    expect(getOAuthConfig()).toBeNull();
    vi.stubEnv("AUTH_URL", "not a url");
    expect(getOAuthConfig()).toBeNull();
  });

  it("a token for staging is bound to a resource that production doesn't serve (CA3)", () => {
    vi.stubEnv("AUTH_URL", "https://staging.example.com");
    const staging = getOAuthConfig()?.resource;
    vi.stubEnv("AUTH_URL", "https://trips.example.com");
    expect(getOAuthConfig()?.resource).not.toBe(staging);
  });
});

describe("withImpliedScopes", () => {
  it("adds the read of each write, delete and suggest", () => {
    expect([...withImpliedScopes(["trips:write", "dives:delete"])].sort()).toEqual(
      ["dives:delete", "dives:read", "trips:read", "trips:write"].sort(),
    );
    expect([...withImpliedScopes(["offline_access"])]).toEqual(["offline_access"]);
  });
});

describe("tokens", () => {
  it("are 32 random bytes behind their prefix, and the hash is SHA-256 in hex", () => {
    const token = generateSecret("tpat_");
    expect(token).toMatch(/^tpat_[A-Za-z0-9_-]{43}$/);
    expect(generateSecret("tpat_")).not.toBe(token);
    expect(secretHash(token)).toBe(createHash("sha256").update(token).digest("hex"));
    expect(generateClientId()).toMatch(/^tpc_[A-Za-z0-9_-]{22}$/);
  });

  it("checks PKCE S256 against the challenge", () => {
    const verifier = "a".repeat(43) + "-._~";
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    expect(isCodeChallenge(challenge)).toBe(true);
    expect(verifyPkce(verifier, challenge)).toBe(true);
    expect(verifyPkce("b".repeat(43), challenge)).toBe(false);
    expect(verifyPkce("short", challenge)).toBe(false);
    expect(verifyPkce(verifier, verifier)).toBe(false);
    expect(isCodeChallenge("plain")).toBe(false);
  });
});

describe("safeCallbackUrl", () => {
  it("keeps a relative path to the authorization endpoint", () => {
    expect(safeCallbackUrl("/oauth/authorize?client_id=tpc_x&state=a%20b")).toBe(
      "/oauth/authorize?client_id=tpc_x&state=a%20b",
    );
  });

  it.each([
    "/dashboard/../admin",
    "//evil.example",
    "/\\evil.example",
    "https://evil.example/oauth/authorize?",
    "/oauth/authorize/../../admin?",
    "/oauth/authorizex?a=1",
    "/oauth/authorize?\nx",
    "",
    undefined,
    ["/oauth/authorize?a"],
  ])("sends %j to the dashboard", (value) => {
    expect(safeCallbackUrl(value)).toBe("/dashboard");
  });
});

describe("RateLimiter", () => {
  it("lets the limit through in a window and then says how long to wait", () => {
    const limiter = new RateLimiter(2, 60_000);
    expect(limiter.hit("k", 0).limited).toBe(false);
    expect(limiter.hit("k", 1000).limited).toBe(false);
    expect(limiter.hit("k", 2000)).toEqual({ limited: true, retryAfterSeconds: 58 });
    expect(limiter.hit("other", 2000).limited).toBe(false);
    expect(limiter.hit("k", 60_001).limited).toBe(false);
  });

  it("peek does not count, record does", () => {
    const limiter = new RateLimiter(1, 60_000);
    expect(limiter.peek("k", 0).limited).toBe(false);
    expect(limiter.peek("k", 0).limited).toBe(false);
    limiter.record("k", 0);
    expect(limiter.peek("k", 1).limited).toBe(true);
  });

  it("takes the address from CF-Connecting-IP, then X-Real-IP", () => {
    expect(clientIp(new Headers({ "cf-connecting-ip": "1.2.3.4", "x-real-ip": "5.6.7.8" }))).toBe("1.2.3.4");
    expect(clientIp(new Headers({ "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});

describe("isAllowedRedirectUri (CA28)", () => {
  it.each(["https://app.example.com/callback", "http://localhost:8080/cb", "http://127.0.0.1/cb"])("accepts %s", (uri) => {
    expect(isAllowedRedirectUri(uri)).toBe(true);
  });

  it.each([
    "http://app.example.com/callback",
    "https://*.example.com/cb",
    "https://app.example.com/cb#frag",
    "https://user:pass@app.example.com/cb",
    "javascript:alert(1)",
    "myapp://callback",
    "https://app.example.com/" + "a".repeat(2048),
    "",
  ])("rejects %s", (uri) => {
    expect(isAllowedRedirectUri(uri)).toBe(false);
  });

  it("knows the loopback, for the warning of the consent screen", () => {
    expect(isLoopbackRedirect("http://localhost:3000/cb")).toBe(true);
    expect(isLoopbackRedirect("https://app.example.com/cb")).toBe(false);
  });
});
