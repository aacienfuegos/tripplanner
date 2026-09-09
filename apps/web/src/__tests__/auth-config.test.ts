import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { timingSafeStringEqual } from "@/lib/timing-safe";

/**
 * Tests for the authorized() callback logic in auth.config.ts.
 * We test the behavior directly without importing Next.js internals.
 */

// Replicated logic from authConfig.callbacks.authorized
function authorized(isLoggedIn: boolean, pathname: string): boolean | "redirect" {
  const isAuthPage = pathname.startsWith("/auth");
  if (isAuthPage) return true;
  if (isLoggedIn) return true;
  return "redirect";
}

describe("auth authorized callback", () => {
  it("allows unauthenticated access to /auth/signin", () => {
    expect(authorized(false, "/auth/signin")).toBe(true);
  });

  it("allows unauthenticated access to /auth/error", () => {
    expect(authorized(false, "/auth/error")).toBe(true);
  });

  it("allows authenticated access to /dashboard", () => {
    expect(authorized(true, "/dashboard")).toBe(true);
  });

  it("allows authenticated access to /trips", () => {
    expect(authorized(true, "/trips")).toBe(true);
  });

  it("redirects unauthenticated user from /dashboard", () => {
    expect(authorized(false, "/dashboard")).toBe("redirect");
  });

  it("redirects unauthenticated user from /trips/abc", () => {
    expect(authorized(false, "/trips/abc")).toBe("redirect");
  });

  it("allows authenticated user to access auth pages (already logged in)", () => {
    // Auth pages always return true regardless of login state
    expect(authorized(true, "/auth/signin")).toBe(true);
  });
});

// ─── DEV credentials authorize logic ─────────────────────────────────────────
// Replicates src/lib/auth.ts's dev-credentials authorize(), which uses
// timingSafeStringEqual instead of === (issue #191 — timing attack on dev login).

describe("dev credentials authorize", () => {
  const DEV_EMAIL = "admin@dev.local";
  const DEV_PASSWORD = "admin123";
  const DEV_USER_ID = "dev-local-user-001";

  function authorize(email: string | undefined, password: string | undefined) {
    if (
      email !== undefined &&
      password !== undefined &&
      timingSafeStringEqual(email.trim(), DEV_EMAIL.trim()) &&
      timingSafeStringEqual(password, DEV_PASSWORD)
    ) {
      return { id: DEV_USER_ID, email: DEV_EMAIL, name: "Dev Admin" };
    }
    return null;
  }

  it("returns dev user for correct credentials", () => {
    const user = authorize(DEV_EMAIL, DEV_PASSWORD);
    expect(user).not.toBeNull();
    expect(user?.id).toBe(DEV_USER_ID);
    expect(user?.name).toBe("Dev Admin");
  });

  it("returns null for wrong password", () => {
    expect(authorize(DEV_EMAIL, "wrongpassword")).toBeNull();
  });

  it("returns null for wrong email", () => {
    expect(authorize("other@dev.local", DEV_PASSWORD)).toBeNull();
  });

  it("returns null for undefined credentials", () => {
    expect(authorize(undefined, undefined)).toBeNull();
  });

  it("trims whitespace from email before comparing", () => {
    expect(authorize("  admin@dev.local  ", DEV_PASSWORD)).not.toBeNull();
  });

  it("returns null for a password of different length than the real one, without throwing", () => {
    expect(() => authorize(DEV_EMAIL, "x")).not.toThrow();
    expect(authorize(DEV_EMAIL, "x")).toBeNull();
    expect(authorize(DEV_EMAIL, "a-much-longer-password-than-the-real-one")).toBeNull();
  });
});

// ─── Dev Login staging gate ───────────────────────────────────────────────────
// Staging and production share the same Docker image (next start forces
// NODE_ENV=production in both) — ALLOW_DEV_LOGIN is the only thing that tells
// them apart, and must never be satisfiable by NODE_ENV alone outside dev.

function devLoginAllowed(nodeEnv: string | undefined, allowDevLoginFlag: string | undefined): boolean {
  return nodeEnv !== "production" || allowDevLoginFlag === "true";
}

describe("dev login staging gate", () => {
  it("is allowed in development regardless of the flag", () => {
    expect(devLoginAllowed("development", undefined)).toBe(true);
  });

  it("is blocked in production without the explicit flag", () => {
    expect(devLoginAllowed("production", undefined)).toBe(false);
  });

  it('is allowed in production only with the flag explicitly set to "true"', () => {
    expect(devLoginAllowed("production", "true")).toBe(true);
  });

  it("is blocked in production for any other flag value (typo-safe)", () => {
    expect(devLoginAllowed("production", "1")).toBe(false);
    expect(devLoginAllowed("production", "yes")).toBe(false);
  });
});

// ─── OAuth account linking (issue #176) ──────────────────────────────────────
// allowDangerousEmailAccountLinking must stay off: it auto-links a new OAuth
// sign-in to an existing account purely by matching email, with no confirmation
// from an already-authenticated session. Guard against it creeping back in.

describe("OAuth provider config — account linking", () => {
  const authConfigSource = readFileSync(
    join(__dirname, "../lib/auth.config.ts"),
    "utf-8",
  );

  it("does not enable allowDangerousEmailAccountLinking anywhere", () => {
    expect(authConfigSource).not.toMatch(/allowDangerousEmailAccountLinking/);
  });
});
