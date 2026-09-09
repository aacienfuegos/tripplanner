import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

import { geocode } from "@/lib/geocoding";

function mockFetchOnce(body: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    json: async () => body,
  });
}

const VALID_RESPONSE = [
  {
    lat: "40.4167754",
    lon: "-3.7037902",
    address: { country: "España", country_code: "es" },
  },
];

describe("geocode", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("parses a valid Nominatim response and normalises the country code", async () => {
    const fetchMock = mockFetchOnce(VALID_RESPONSE);
    vi.stubGlobal("fetch", fetchMock);

    const promise = geocode("Puerta del Sol, Madrid", "owner-a");
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toEqual({
      lat: 40.4167754,
      lng: -3.7037902,
      country: "España",
      countryCode: "ES",
    });
  });

  it("sends an identifying User-Agent header (Nominatim usage policy)", async () => {
    const fetchMock = mockFetchOnce(VALID_RESPONSE);
    vi.stubGlobal("fetch", fetchMock);

    const promise = geocode("Sagrada Familia, Barcelona", "owner-a");
    await vi.runAllTimersAsync();
    await promise;

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["User-Agent"]).toMatch(/TripPlanner/);
  });

  it("returns null for an empty query without calling fetch", async () => {
    const fetchMock = mockFetchOnce(VALID_RESPONSE);
    vi.stubGlobal("fetch", fetchMock);

    const result = await geocode("   ", "owner-a");

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null when the HTTP response is not ok", async () => {
    const fetchMock = mockFetchOnce([], false);
    vi.stubGlobal("fetch", fetchMock);

    const promise = geocode("Non-ok place", "owner-a");
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBeNull();
  });

  it("rejects a malformed response with out-of-range coordinates", async () => {
    const fetchMock = mockFetchOnce([{ lat: "999", lon: "500" }]);
    vi.stubGlobal("fetch", fetchMock);

    const promise = geocode("Hostile injected place", "owner-a");
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBeNull();
  });

  it("returns null for an empty result array", async () => {
    const fetchMock = mockFetchOnce([]);
    vi.stubGlobal("fetch", fetchMock);

    const promise = geocode("Nowhere at all zzz", "owner-a");
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBeNull();
  });

  it("caches results and does not re-fetch the same query", async () => {
    const fetchMock = mockFetchOnce(VALID_RESPONSE);
    vi.stubGlobal("fetch", fetchMock);

    const first = geocode("Coliseo, Roma", "owner-a");
    await vi.runAllTimersAsync();
    await first;

    const second = await geocode("coliseo,   roma", "owner-a");

    expect(second).toEqual({
      lat: 40.4167754,
      lng: -3.7037902,
      country: "España",
      countryCode: "ES",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("interleaves owners round-robin instead of draining one owner's backlog first (#185)", async () => {
    const fetchMock = mockFetchOnce(VALID_RESPONSE);
    vi.stubGlobal("fetch", fetchMock);

    // Owner A encola 3 items (p.ej. backfill de un trip grande) antes de que
    // owner B encole el suyo. Con FIFO puro, B esperaría a que A termine sus
    // 3 llamadas (~2.2s); con round-robin, B entra en el segundo turno.
    const a1 = geocode("Owner A item 1", "owner-a");
    const a2 = geocode("Owner A item 2", "owner-a");
    const a3 = geocode("Owner A item 3", "owner-a");
    const b1 = geocode("Owner B item 1", "owner-b");

    await vi.runAllTimersAsync();
    await Promise.all([a1, a2, a3, b1]);

    const order = fetchMock.mock.calls.map(([url]) => (url as URL).searchParams.get("q"));
    expect(order).toEqual([
      "Owner A item 1",
      "Owner B item 1",
      "Owner A item 2",
      "Owner A item 3",
    ]);
  });

  it("still serialises requests at ~1 req/s even across owners (Nominatim usage policy)", async () => {
    const timestamps: number[] = [];
    const fetchMock = vi.fn().mockImplementation(async () => {
      timestamps.push(Date.now());
      return { ok: true, json: async () => VALID_RESPONSE };
    });
    vi.stubGlobal("fetch", fetchMock);

    const a1 = geocode("Serial A", "owner-a");
    const b1 = geocode("Serial B", "owner-b");

    await vi.runAllTimersAsync();
    await Promise.all([a1, b1]);

    expect(timestamps).toHaveLength(2);
    // MIN_INTERVAL_MS en geocoding.ts — fairness no puede relajar el límite
    // absoluto de Nominatim, solo reordenar a quién le toca cada slot.
    expect(timestamps[1] - timestamps[0]).toBeGreaterThanOrEqual(1100);
  });
});
