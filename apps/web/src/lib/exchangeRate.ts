import { z } from "zod";
import { CURRENCIES } from "@tripplanner/shared";
import { BoundedCache } from "@/lib/bounded-cache";

export { CURRENCIES };

const EXCHANGE_RATE_API = "https://open.er-api.com/v6/latest";
const CACHE_TTL_MS = 60 * 60 * 1000;
// Cache negativa con TTL corto: evita que un fallo transitorio del upstream
// (o una base inválida) dispare una llamada nueva en cada request mientras
// dure la caída, sin retener el "no encontrado" tanto como un resultado real.
const NEGATIVE_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 100;

const rateResponseSchema = z.object({
  result: z.literal("success"),
  rates: z.record(z.string(), z.number()),
});

interface CacheEntry {
  rates: Record<string, number> | null;
  fetchedAt: number;
  ttl: number;
}

const rateCache = new BoundedCache<string, CacheEntry>(MAX_CACHE_ENTRIES);

async function fetchRates(base: string): Promise<Record<string, number> | null> {
  const cached = rateCache.get(base);
  if (cached && Date.now() - cached.fetchedAt < cached.ttl) {
    return cached.rates;
  }

  try {
    const url = new URL(`${EXCHANGE_RATE_API}/${encodeURIComponent(base)}`);
    const res = await fetch(url);
    if (!res.ok) {
      rateCache.set(base, { rates: null, fetchedAt: Date.now(), ttl: NEGATIVE_CACHE_TTL_MS });
      return null;
    }
    const json: unknown = await res.json();
    const parsed = rateResponseSchema.safeParse(json);
    if (!parsed.success) {
      rateCache.set(base, { rates: null, fetchedAt: Date.now(), ttl: NEGATIVE_CACHE_TTL_MS });
      return null;
    }
    rateCache.set(base, { rates: parsed.data.rates, fetchedAt: Date.now(), ttl: CACHE_TTL_MS });
    return parsed.data.rates;
  } catch {
    rateCache.set(base, { rates: null, fetchedAt: Date.now(), ttl: NEGATIVE_CACHE_TTL_MS });
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
