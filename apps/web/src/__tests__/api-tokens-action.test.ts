import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
}));

const apiTokenCreate = vi.fn();
const apiTokenUpdateMany = vi.fn();
const userFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    apiToken: {
      create: (...args: unknown[]) => apiTokenCreate(...args),
      updateMany: (...args: unknown[]) => apiTokenUpdateMany(...args),
    },
    user: { findUnique: (...args: unknown[]) => userFindUnique(...args) },
  },
}));

import { createApiToken, revokeApiToken } from "@/actions/api-tokens";
import { hashApiToken } from "@/lib/api-token";

const DAY = 24 * 60 * 60 * 1000;

function tokenForm({
  name = "Agente de viajes",
  scopes = ["TRIPS_READ", "ACTIVITIES_WRITE"],
  expiry,
}: { name?: string; scopes?: string[]; expiry?: string } = {}) {
  const formData = new FormData();
  formData.set("name", name);
  for (const scope of scopes) formData.append("scopes", scope);
  if (expiry) formData.set("expiry", expiry);
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  userFindUnique.mockResolvedValue({ status: "APPROVED" });
  apiTokenCreate.mockResolvedValue({ id: "tok-1" });
  apiTokenUpdateMany.mockResolvedValue({ count: 0 });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createApiToken", () => {
  it("returns the plain token once and stores only its hash", async () => {
    const result = await createApiToken(tokenForm());
    expect(result.id).toBe("tok-1");
    expect(result.token).toMatch(/^tp_[A-Za-z0-9_-]{43}$/);

    const { data } = apiTokenCreate.mock.calls[0][0];
    expect(data).toMatchObject({
      userId: "user-1",
      name: "Agente de viajes",
      tokenHash: hashApiToken(result.token),
      prefix: result.token.slice(0, 10),
      scopes: ["TRIPS_READ", "ACTIVITIES_WRITE"],
    });
    expect(JSON.stringify(data)).not.toContain(result.token);
    expect(revalidatePath).toHaveBeenCalledWith("/profile");
  });

  it("expires in 90 days by default", async () => {
    const before = Date.now();
    await createApiToken(tokenForm());
    const expiresAt: Date = apiTokenCreate.mock.calls[0][0].data.expiresAt;
    expect(expiresAt.getTime() - before).toBeGreaterThanOrEqual(90 * DAY - 1000);
    expect(expiresAt.getTime() - before).toBeLessThanOrEqual(90 * DAY + 1000);
  });

  it("honours the chosen expiry", async () => {
    const before = Date.now();
    await createApiToken(tokenForm({ expiry: "365" }));
    const expiresAt: Date = apiTokenCreate.mock.calls[0][0].data.expiresAt;
    expect(Math.round((expiresAt.getTime() - before) / DAY)).toBe(365);
  });

  it("stores no expiry with never", async () => {
    await createApiToken(tokenForm({ expiry: "never" }));
    expect(apiTokenCreate.mock.calls[0][0].data.expiresAt).toBeNull();
  });

  it("rejects a token without scopes", async () => {
    await expect(createApiToken(tokenForm({ scopes: [] }))).rejects.toThrow();
    expect(apiTokenCreate).not.toHaveBeenCalled();
  });

  it("rejects an unknown scope or expiry", async () => {
    await expect(createApiToken(tokenForm({ scopes: ["ADMIN"] }))).rejects.toThrow();
    await expect(createApiToken(tokenForm({ expiry: "7" }))).rejects.toThrow();
    expect(apiTokenCreate).not.toHaveBeenCalled();
  });

  it("never writes the token to the console", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation(() => {}),
    );
    const { token } = await createApiToken(tokenForm());
    const printed = spies.flatMap((spy) => spy.mock.calls.flat()).map((arg) => String(arg));
    for (const text of printed) expect(text).not.toContain(token);
  });
});

describe("revokeApiToken", () => {
  it("scopes the update to the current user, so another user's token is untouched", async () => {
    await revokeApiToken("tok-of-someone-else");
    expect(apiTokenUpdateMany).toHaveBeenCalledWith({
      where: { id: "tok-of-someone-else", userId: "user-1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/profile");
  });
});
