import { describe, it, expect, vi } from "vitest";

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

describe("dev credentials authorize", () => {
  const DEV_EMAIL = "admin@dev.local";
  const DEV_PASSWORD = "admin123";
  const DEV_USER_ID = "dev-local-user-001";

  function authorize(email: string | undefined, password: string | undefined) {
    if (
      email?.trim() === DEV_EMAIL.trim() &&
      password === DEV_PASSWORD
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
});
