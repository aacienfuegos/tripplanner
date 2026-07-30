import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { readdirSync, rmSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildDivingLogFixture } from "./helpers/divinglog-fixture";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
}));

const userFindUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: (...args: unknown[]) => userFindUnique(...args) },
  },
}));

const fixturePath = buildDivingLogFixture();

afterAll(() => {
  rmSync(path.dirname(fixturePath), { recursive: true, force: true });
});

async function fixtureAsFile(): Promise<File> {
  const bytes = readFileSync(fixturePath);
  return new File([bytes], "logbook.sqlite");
}

// happy-dom's Headers polyfill enforces the browser fetch spec's forbidden-header
// list and silently drops "origin"/"host" set via new Request(); a real Next.js
// Route Handler gets these as raw HTTP headers from the server, not from that
// constructor, so a minimal stub matching what the handler actually reads is a
// closer approximation than fighting the polyfill.
function postRequest(formData: FormData, headers: Record<string, string> = { origin: "http://localhost", host: "localhost" }): Request {
  return {
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    formData: () => Promise.resolve(formData),
  } as unknown as Request;
}

beforeEach(() => {
  vi.clearAllMocks();
  userFindUnique.mockResolvedValue({ status: "APPROVED" });
});

describe("POST /api/dives/import", () => {
  it("rejects a cross-origin request", async () => {
    const { POST } = await import("@/app/api/dives/import/route");
    const fd = new FormData();
    fd.set("file", await fixtureAsFile());
    const request = postRequest(fd, { origin: "http://evil.example", host: "localhost" });
    const response = await POST(request);
    expect(response.status).toBe(403);
    expect((await response.json()).ok).toBe(false);
  });

  it("rejects a request missing origin/host headers entirely", async () => {
    const { POST } = await import("@/app/api/dives/import/route");
    const fd = new FormData();
    fd.set("file", await fixtureAsFile());
    const response = await POST(postRequest(fd, {}));
    expect(response.status).toBe(403);
  });

  it("rejects a non-file value", async () => {
    const { POST } = await import("@/app/api/dives/import/route");
    const fd = new FormData();
    fd.set("file", "not-a-file");
    const result = await (await POST(postRequest(fd))).json();
    expect(result.ok).toBe(false);
  });

  it("rejects a file over the size limit", async () => {
    const { POST } = await import("@/app/api/dives/import/route");
    const huge = new File([new Uint8Array(50 * 1024 * 1024 + 1)], "huge.sqlite");
    const fd = new FormData();
    fd.set("file", huge);
    const result = await (await POST(postRequest(fd))).json();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe("FILE_TOO_LARGE");
  }, 15000);

  it("parses a valid Diving Log SQLite file into a payload", async () => {
    const { POST } = await import("@/app/api/dives/import/route");
    const fd = new FormData();
    fd.set("file", await fixtureAsFile());
    const result = await (await POST(postRequest(fd))).json();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.sites).toHaveLength(3);
      expect(result.payload.logs).toHaveLength(4);
      expect(result.payload.certifications).toHaveLength(1);
    }
  });

  it("returns a clear error, not a throw, for a corrupt file", async () => {
    const { POST } = await import("@/app/api/dives/import/route");
    const fd = new FormData();
    fd.set("file", new File(["not a sqlite file at all"], "corrupt.sqlite"));
    const result = await (await POST(postRequest(fd))).json();
    expect(result.ok).toBe(false);
  });

  it("always deletes the temp file, even after a parse failure", async () => {
    const { POST } = await import("@/app/api/dives/import/route");
    const before = readdirSync(os.tmpdir()).filter((f) => f.startsWith("divinglog-import-"));
    expect(before).toHaveLength(0);

    const fd = new FormData();
    fd.set("file", new File(["not a sqlite file at all"], "corrupt.sqlite"));
    await POST(postRequest(fd));

    const after = readdirSync(os.tmpdir()).filter((f) => f.startsWith("divinglog-import-"));
    expect(after).toHaveLength(0);
  });
});
