import "server-only";
import { z } from "zod";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
// Nominatim exige un User-Agent identificable; el default de undici hace que baneen la IP.
const USER_AGENT = "TripPlanner/1.0 (+https://github.com/aacienfuegos/tripplanner)";
const MIN_INTERVAL_MS = 1100;

export type GeoResult = {
  readonly lat: number;
  readonly lng: number;
  readonly country: string | null;
  readonly countryCode: string | null;
};

const nominatimResultSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  address: z
    .object({
      country: z.string().optional(),
      country_code: z.string().optional(),
    })
    .optional(),
});

const nominatimResponseSchema = z.array(nominatimResultSchema);

const cache = new Map<string, GeoResult | null>();

// Cola serie: Nominatim permite máx. 1 req/s. Encadenamos las llamadas y
// esperamos el intervalo mínimo entre cada una para no disparar en paralelo.
let lastRequestAt = 0;
let queue: Promise<unknown> = Promise.resolve();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function throttle<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = MIN_INTERVAL_MS - (Date.now() - lastRequestAt);
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
    return task();
  });
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function geocode(query: string): Promise<GeoResult | null> {
  const key = query.trim().toLowerCase().replace(/\s+/g, " ");
  if (!key) return null;
  if (cache.has(key)) return cache.get(key) ?? null;

  const result = await throttle(async () => {
    const url = new URL(NOMINATIM_URL);
    url.searchParams.set("q", query);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    url.searchParams.set("addressdetails", "1");

    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "es" },
    });
    if (!response.ok) return null;

    const parsed = nominatimResponseSchema.safeParse(await response.json());
    if (!parsed.success || parsed.data.length === 0) return null;

    const [first] = parsed.data;
    return {
      lat: first.lat,
      lng: first.lon,
      country: first.address?.country ?? null,
      countryCode: first.address?.country_code?.toUpperCase() ?? null,
    } satisfies GeoResult;
  });

  cache.set(key, result);
  return result;
}
