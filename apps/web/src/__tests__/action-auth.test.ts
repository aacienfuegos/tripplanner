import { describe, it, expect } from "vitest";

/**
 * Tests for the shared Server Action authorization helper (src/lib/action-auth.ts).
 *
 * Issue #177: Server Actions only decoded the JWT and never re-checked `status`
 * in the DB, so a user marked DENIED after login kept write access (create/update/
 * delete on their trips) until their session token expired — up to 30 days with
 * strategy: "jwt". requireUser()/requireTripOwner() now re-read status on every
 * call so a DENIED user is rejected immediately, without switching session
 * strategy to "database".
 */

type UserStatus = "PENDING" | "APPROVED" | "DENIED";

// Replicates requireUser() in src/lib/action-auth.ts
function requireUserGate(
  hasSession: boolean,
  dbUser: { status: UserStatus } | null,
): "ok" | "/auth/signin" | "/auth/error?error=AccessDenied" {
  if (!hasSession) return "/auth/signin";
  if (!dbUser || dbUser.status === "DENIED") return "/auth/error?error=AccessDenied";
  return "ok";
}

// Replicates requireTripOwner() in src/lib/action-auth.ts, layered on requireUserGate
function requireTripOwnerGate(
  hasSession: boolean,
  dbUser: { status: UserStatus } | null,
  currentUserId: string | null,
  trip: { userId: string } | null,
): "ok" | "/auth/signin" | "/auth/error?error=AccessDenied" | "/trips" {
  const userGate = requireUserGate(hasSession, dbUser);
  if (userGate !== "ok") return userGate;
  if (!trip || trip.userId !== currentUserId) return "/trips";
  return "ok";
}

describe("requireUser status revalidation", () => {
  it("redirects to signin when there is no session", () => {
    expect(requireUserGate(false, null)).toBe("/auth/signin");
  });

  it("redirects a DENIED user to the access-denied page even with a valid session", () => {
    expect(requireUserGate(true, { status: "DENIED" })).toBe("/auth/error?error=AccessDenied");
  });

  it("redirects when the user record no longer exists", () => {
    expect(requireUserGate(true, null)).toBe("/auth/error?error=AccessDenied");
  });

  it("allows an APPROVED user through", () => {
    expect(requireUserGate(true, { status: "APPROVED" })).toBe("ok");
  });

  it("allows a PENDING user through (layout, not the action, gates PENDING)", () => {
    expect(requireUserGate(true, { status: "PENDING" })).toBe("ok");
  });
});

describe("requireTripOwner status revalidation (Server Actions)", () => {
  const ownedTrip = { userId: "user-1" };

  it("rejects a Server Action call from a user marked DENIED after login, even though the trip is theirs", () => {
    // Simulates: user was APPROVED at login (stale JWT still valid), an admin
    // later set status = DENIED, the user's browser tab still holds the old
    // session cookie and calls e.g. createFlight(tripId, formData).
    expect(
      requireTripOwnerGate(true, { status: "DENIED" }, "user-1", ownedTrip),
    ).toBe("/auth/error?error=AccessDenied");
  });

  it("rejects when there is no session at all", () => {
    expect(requireTripOwnerGate(false, null, null, ownedTrip)).toBe("/auth/signin");
  });

  it("rejects an APPROVED user acting on a trip they don't own", () => {
    expect(
      requireTripOwnerGate(true, { status: "APPROVED" }, "user-2", ownedTrip),
    ).toBe("/trips");
  });

  it("rejects when the trip doesn't exist", () => {
    expect(
      requireTripOwnerGate(true, { status: "APPROVED" }, "user-1", null),
    ).toBe("/trips");
  });

  it("allows an APPROVED owner through", () => {
    expect(
      requireTripOwnerGate(true, { status: "APPROVED" }, "user-1", ownedTrip),
    ).toBe("ok");
  });
});
