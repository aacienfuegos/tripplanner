// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHash } from "node:crypto";
import { fakeOAuthDb } from "./helpers/fake-oauth-db";

vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers({ "cf-connecting-ip": "203.0.113.9" })) }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
}));
vi.mock("next/link", () => ({ default: () => null }));
vi.mock("@/components/agents/consent-form", () => ({ ConsentForm: () => null }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => ({ user: { id: "user-a" } })) }));
vi.mock("@/lib/locale", async () => ({ getT: async () => (await import("@/i18n")).es }));
vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers/fake-oauth-db")).fakeOAuthPrisma }));
vi.mock("@/lib/oauth/cimd", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/oauth/cimd")>()),
  fetchClientMetadata: vi.fn(),
}));

import { redirect } from "next/navigation";
import { fetchClientMetadata } from "@/lib/oauth/cimd";
import AuthorizePage from "@/app/oauth/authorize/page";

const ISSUER = "https://trips.example.com";
const MANUAL = "tpc_AAAAAAAAAAAAAAAAAAAAAA";
const REDIRECT = "https://agent.example.com/callback";
const PHISH = "https://evil.example/phish";

const query = (overrides: Record<string, string> = {}) => ({
  response_type: "code",
  client_id: MANUAL,
  redirect_uri: REDIRECT,
  code_challenge: createHash("sha256").update("v".repeat(50)).digest("base64url"),
  code_challenge_method: "S256",
  scope: "trips:read",
  state: "st4te",
  ...overrides,
});

const render = (params: Record<string, string>) => AuthorizePage({ searchParams: Promise.resolve(params) });

beforeEach(() => {
  vi.stubEnv("AUTH_URL", ISSUER);
  vi.mocked(redirect).mockClear();
  fakeOAuthDb.reset({
    user: [{ id: "user-a", status: "APPROVED" }],
    oAuthClient: [{ id: "client-a", clientId: MANUAL, kind: "MANUAL", name: "Agente", redirectUris: [REDIRECT], ownerUserId: "user-a" }],
  });
  vi.mocked(fetchClientMetadata).mockResolvedValue({ name: "Phish", redirectUris: [PHISH] });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("/oauth/authorize", () => {
  it("shows its own page for a CIMD client with an invalid response type, without redirecting (CWE-601)", async () => {
    const page = await render(query({ client_id: "https://evil.example/c.json", redirect_uri: PHISH, response_type: "x" }));
    expect(redirect).not.toHaveBeenCalled();
    const { text, back } = page.props as { text: string; back: { href: string; host: string } };
    expect(text).toContain("unsupported_response_type");
    expect(back.host).toBe("evil.example");
    const url = new URL(back.href);
    expect(url.origin + url.pathname).toBe(PHISH);
    expect(url.searchParams.get("error")).toBe("unsupported_response_type");
  });

  it("still sends a manual client back with the error on its own", async () => {
    await expect(render(query({ response_type: "x" }))).rejects.toThrow(/^NEXT_REDIRECT https:\/\/agent\.example\.com\/callback\?error=unsupported_response_type/);
    expect(redirect).toHaveBeenCalledTimes(1);
  });
});
