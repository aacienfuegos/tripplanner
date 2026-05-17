import { describe, it, expect } from "vitest";

// ─── requireAdmin logic ───────────────────────────────────────────────────────
// Replicates the guard in src/actions/admin.ts and src/app/(app)/admin/page.tsx

type AuthResult = { userId: string | null; isAdmin: boolean };

function requireAdmin(auth: AuthResult): "ok" | "/auth/signin" | "/dashboard" {
  if (!auth.userId) return "/auth/signin";
  if (!auth.isAdmin) return "/dashboard";
  return "ok";
}

describe("requireAdmin", () => {
  it("redirects to /auth/signin when no session", () => {
    expect(requireAdmin({ userId: null, isAdmin: false })).toBe("/auth/signin");
  });

  it("redirects to /dashboard for authenticated non-admin", () => {
    expect(requireAdmin({ userId: "user-123", isAdmin: false })).toBe("/dashboard");
  });

  it("allows through for authenticated admin", () => {
    expect(requireAdmin({ userId: "user-123", isAdmin: true })).toBe("ok");
  });
});

// ─── admin action guards ──────────────────────────────────────────────────────
// approveUser / denyUser / revokeUser may not act on admin users

function canModifyUser(targetIsAdmin: boolean): boolean {
  return !targetIsAdmin;
}

describe("admin action guards", () => {
  it("allows modifying a regular user", () => {
    expect(canModifyUser(false)).toBe(true);
  });

  it("prevents modifying an admin user", () => {
    expect(canModifyUser(true)).toBe(false);
  });
});

// ─── app layout gating ───────────────────────────────────────────────────────
// Replicates the status-based redirect logic in src/app/(app)/layout.tsx

type UserStatus = "PENDING" | "APPROVED" | "DENIED";

function layoutGate(
  hasSession: boolean,
  user: { status: UserStatus } | null
): "render" | "/auth/signin" | "/auth/pending" | "/auth/error?error=AccessDenied" {
  if (!hasSession) return "/auth/signin";
  if (!user || user.status === "DENIED") return "/auth/error?error=AccessDenied";
  if (user.status === "PENDING") return "/auth/pending";
  return "render";
}

describe("app layout gating", () => {
  it("redirects to signin when no session", () => {
    expect(layoutGate(false, null)).toBe("/auth/signin");
  });

  it("redirects PENDING user to /auth/pending", () => {
    expect(layoutGate(true, { status: "PENDING" })).toBe("/auth/pending");
  });

  it("redirects DENIED user to /auth/error", () => {
    expect(layoutGate(true, { status: "DENIED" })).toBe("/auth/error?error=AccessDenied");
  });

  it("redirects when user record is missing", () => {
    expect(layoutGate(true, null)).toBe("/auth/error?error=AccessDenied");
  });

  it("renders for APPROVED user", () => {
    expect(layoutGate(true, { status: "APPROVED" })).toBe("render");
  });
});

// ─── pending page gating ─────────────────────────────────────────────────────
// Replicates redirect logic in src/app/auth/pending/page.tsx

function pendingPageGate(
  hasSession: boolean,
  status: UserStatus | undefined
): "render" | "/auth/signin" | "/dashboard" | "/auth/error?error=AccessDenied" {
  if (!hasSession) return "/auth/signin";
  if (status === "APPROVED") return "/dashboard";
  if (status === "DENIED") return "/auth/error?error=AccessDenied";
  return "render";
}

describe("pending page gating", () => {
  it("redirects to signin when no session", () => {
    expect(pendingPageGate(false, undefined)).toBe("/auth/signin");
  });

  it("redirects APPROVED user to /dashboard", () => {
    expect(pendingPageGate(true, "APPROVED")).toBe("/dashboard");
  });

  it("redirects DENIED user to /auth/error", () => {
    expect(pendingPageGate(true, "DENIED")).toBe("/auth/error?error=AccessDenied");
  });

  it("renders for PENDING user", () => {
    expect(pendingPageGate(true, "PENDING")).toBe("render");
  });
});
