import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock next/navigation redirect before importing the action
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

// Mock next/dist redirect-error detection
vi.mock("next/dist/client/components/redirect-error", () => ({
  isRedirectError: () => false,
}));

// Mock auth — return a valid session by default
vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "test-user-001" } }),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const AGENTOS_URL = "http://agentos-test:8000";
const AGENTOS_KEY = "sk-agentos-testkey";

const VALID_PAYLOAD = {
  flights: [
    {
      airline: "Iberia",
      flightNumber: "IB3456",
      origin: "MAD",
      destination: "BCN",
      departureAt: "2026-07-10T07:30:00",
      arrivalAt: "2026-07-10T08:45:00",
    },
  ],
};

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("runAgentOSImport", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.AGENTOS_URL = AGENTOS_URL;
    process.env.AGENTOS_API_KEY = AGENTOS_KEY;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.AGENTOS_URL;
    delete process.env.AGENTOS_API_KEY;
    vi.clearAllMocks();
  });

  it("returns ImportPayload on successful response", async () => {
    global.fetch = mockFetch(200, { output: JSON.stringify(VALID_PAYLOAD) });
    const { runAgentOSImport } = await import("@/actions/agentos");
    const result = await runAgentOSImport("Vuelo IB3456 Madrid-Barcelona el 10 de julio");
    expect(result.flights).toHaveLength(1);
    expect(result.flights[0].airline).toBe("Iberia");
  });

  it("strips markdown code fences from Claude output", async () => {
    const withFences = "```json\n" + JSON.stringify(VALID_PAYLOAD) + "\n```";
    global.fetch = mockFetch(200, { output: withFences });
    const { runAgentOSImport } = await import("@/actions/agentos");
    const result = await runAgentOSImport("some content");
    expect(result.flights).toHaveLength(1);
  });

  it("returns empty sections when output contains only some sections", async () => {
    global.fetch = mockFetch(200, { output: JSON.stringify({ accommodations: [] }) });
    const { runAgentOSImport } = await import("@/actions/agentos");
    const result = await runAgentOSImport("some content");
    expect(result.flights).toHaveLength(0);
    expect(result.accommodations).toHaveLength(0);
  });

  it("throws descriptive error on 408 timeout", async () => {
    global.fetch = mockFetch(408, { detail: { error: "Timeout after 120s" } });
    const { runAgentOSImport } = await import("@/actions/agentos");
    await expect(runAgentOSImport("some content")).rejects.toThrow(
      "La IA tardó demasiado",
    );
  });

  it("throws descriptive error on 429 rate limit", async () => {
    global.fetch = mockFetch(429, { detail: "Too many concurrent API runs (max 3)" });
    const { runAgentOSImport } = await import("@/actions/agentos");
    await expect(runAgentOSImport("some content")).rejects.toThrow(
      "Demasiadas peticiones simultáneas",
    );
  });

  it("throws descriptive error on 401 unauthorized", async () => {
    global.fetch = mockFetch(401, { detail: "Unauthorized" });
    const { runAgentOSImport } = await import("@/actions/agentos");
    await expect(runAgentOSImport("some content")).rejects.toThrow(
      "La API key de AgentOS",
    );
  });

  it("throws when output is not valid JSON", async () => {
    global.fetch = mockFetch(200, { output: "Aquí hay texto pero no JSON" });
    const { runAgentOSImport } = await import("@/actions/agentos");
    await expect(runAgentOSImport("some content")).rejects.toThrow(
      "no devolvió un JSON válido",
    );
  });

  it("throws when env vars are missing", async () => {
    delete process.env.AGENTOS_URL;
    delete process.env.AGENTOS_API_KEY;
    const { runAgentOSImport } = await import("@/actions/agentos");
    await expect(runAgentOSImport("some content")).rejects.toThrow(
      "no está configurado",
    );
  });

  it("calls AgentOS with haiku model, web tools, and correct auth header", async () => {
    const fetchMock = mockFetch(200, { output: JSON.stringify(VALID_PAYLOAD) });
    global.fetch = fetchMock;
    const { runAgentOSImport } = await import("@/actions/agentos");
    await runAgentOSImport("some content");

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${AGENTOS_URL}/api/execute`);
    expect((options.headers as Record<string, string>)["Authorization"]).toBe(
      `Bearer ${AGENTOS_KEY}`,
    );
    const body = JSON.parse(options.body as string);
    expect(body.model).toBe("claude-haiku-4-5-20251001");
    expect(body.prompt).toBe("some content");
    expect(body.tools).toEqual(["WebFetch", "WebSearch"]);
    expect(body.timeout_seconds).toBe(180);
  });
});
