import { describe, it, expect, vi, afterEach } from "vitest";
import { getExchangeRate } from "@/lib/exchangeRate";

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

describe("getExchangeRate", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("returns 1 without calling the API when currencies match", async () => {
    const fetchMock = mockFetch(200, { result: "success", rates: { EUR: 1 } });
    global.fetch = fetchMock;

    const rate = await getExchangeRate("EUR", "EUR");

    expect(rate).toBe(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Cada test usa una moneda "from" distinta — el cache interno vive
  // por proceso de test, no se resetea entre `it`s.

  it("returns the rate for the target currency on success", async () => {
    global.fetch = mockFetch(200, { result: "success", rates: { EUR: 0.92, GBP: 0.79 } });

    const rate = await getExchangeRate("USD", "EUR");

    expect(rate).toBe(0.92);
  });

  it("returns null when the HTTP response is not ok", async () => {
    global.fetch = mockFetch(500, {});

    const rate = await getExchangeRate("GBP", "EUR");

    expect(rate).toBeNull();
  });

  it("returns null when the response body fails schema validation", async () => {
    global.fetch = mockFetch(200, { result: "error", message: "unknown-code" });

    const rate = await getExchangeRate("JPY", "EUR");

    expect(rate).toBeNull();
  });

  it("returns null when the target currency is missing from rates", async () => {
    global.fetch = mockFetch(200, { result: "success", rates: { GBP: 0.79 } });

    const rate = await getExchangeRate("CHF", "EUR");

    expect(rate).toBeNull();
  });

  it("returns null when the network request throws", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down"));

    const rate = await getExchangeRate("CAD", "EUR");

    expect(rate).toBeNull();
  });

  it("caches the rates and does not refetch within the TTL", async () => {
    const fetchMock = mockFetch(200, { result: "success", rates: { EUR: 0.9, GBP: 0.78 } });
    global.fetch = fetchMock;

    await getExchangeRate("AUD", "EUR");
    await getExchangeRate("AUD", "GBP");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
