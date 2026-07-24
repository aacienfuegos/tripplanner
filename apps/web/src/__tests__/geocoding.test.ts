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

    const promise = geocode("Puerta del Sol, Madrid");
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

    const promise = geocode("Sagrada Familia, Barcelona");
    await vi.runAllTimersAsync();
    await promise;

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["User-Agent"]).toMatch(/TripPlanner/);
  });

  it("returns null for an empty query without calling fetch", async () => {
    const fetchMock = mockFetchOnce(VALID_RESPONSE);
    vi.stubGlobal("fetch", fetchMock);

    const result = await geocode("   ");

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null when the HTTP response is not ok", async () => {
    const fetchMock = mockFetchOnce([], false);
    vi.stubGlobal("fetch", fetchMock);

    const promise = geocode("Non-ok place");
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBeNull();
  });

  it("rejects a malformed response with out-of-range coordinates", async () => {
    const fetchMock = mockFetchOnce([{ lat: "999", lon: "500" }]);
    vi.stubGlobal("fetch", fetchMock);

    const promise = geocode("Hostile injected place");
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBeNull();
  });

  it("returns null for an empty result array", async () => {
    const fetchMock = mockFetchOnce([]);
    vi.stubGlobal("fetch", fetchMock);

    const promise = geocode("Nowhere at all zzz");
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBeNull();
  });

  it("caches results and does not re-fetch the same query", async () => {
    const fetchMock = mockFetchOnce(VALID_RESPONSE);
    vi.stubGlobal("fetch", fetchMock);

    const first = geocode("Coliseo, Roma");
    await vi.runAllTimersAsync();
    await first;

    const second = await geocode("coliseo,   roma");

    expect(second).toEqual({
      lat: 40.4167754,
      lng: -3.7037902,
      country: "España",
      countryCode: "ES",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
