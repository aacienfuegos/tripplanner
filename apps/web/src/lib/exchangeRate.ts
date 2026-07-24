import { z } from "zod";

const EXCHANGE_RATE_API = "https://open.er-api.com/v6/latest";
const CACHE_TTL_MS = 60 * 60 * 1000;

const rateResponseSchema = z.object({
  result: z.literal("success"),
  rates: z.record(z.string(), z.number()),
});

interface CacheEntry {
  rates: Record<string, number>;
  fetchedAt: number;
}

const rateCache = new Map<string, CacheEntry>();

async function fetchRates(base: string): Promise<Record<string, number> | null> {
  const cached = rateCache.get(base);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.rates;
  }

  try {
    const res = await fetch(`${EXCHANGE_RATE_API}/${base}`);
    if (!res.ok) return null;
    const json: unknown = await res.json();
    const parsed = rateResponseSchema.safeParse(json);
    if (!parsed.success) return null;
    rateCache.set(base, { rates: parsed.data.rates, fetchedAt: Date.now() });
    return parsed.data.rates;
  } catch {
    return null;
  }
}

// Devuelve null si la API externa falla o la moneda no existe — el llamador
// debe degradar a "sin conversión" en vez de bloquear la operación.
export async function getExchangeRate(from: string, to: string): Promise<number | null> {
  if (from === to) return 1;
  const rates = await fetchRates(from);
  if (!rates) return null;
  const rate = rates[to];
  return typeof rate === "number" ? rate : null;
}
