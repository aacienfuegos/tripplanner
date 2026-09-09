import "server-only";
import { z } from "zod";
import { BoundedCache } from "@/lib/bounded-cache";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
// Nominatim exige un User-Agent identificable; el default de undici hace que baneen la IP.
const USER_AGENT = "TripPlanner/1.0 (+https://github.com/aacienfuegos/tripplanner)";
const MIN_INTERVAL_MS = 1100;
// Las claves son nombres/direcciones libres introducidos por usuarios — sin
// cota, un proceso de larga duración crece indefinidamente (#195).
const MAX_CACHE_ENTRIES = 500;

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

const cache = new BoundedCache<string, GeoResult | null>(MAX_CACHE_ENTRIES);

// Nominatim exige máx. 1 req/s para todo el proceso (no por usuario), así
// que ese límite global no se puede eliminar. Lo que sí se puede evitar es
// que un solo owner (trip/usuario) con muchos items pendientes acapare ese
// único slot por segundo: el scheduling es round-robin por owner en vez de
// FIFO puro, así que un backfill grande de un trip no retrasa indefinidamente
// el geocoding de otros trips/usuarios (#185).
class FairThrottle {
  private readonly queues = new Map<string, Array<() => void>>();
  private readonly rotation: string[] = [];
  private lastRequestAt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  schedule<T>(ownerId: string, task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      let bucket = this.queues.get(ownerId);
      if (!bucket) {
        bucket = [];
        this.queues.set(ownerId, bucket);
        this.rotation.push(ownerId);
      }
      bucket.push(() => task().then(resolve, reject));
      this.ensureScheduled();
    });
  }

  private ensureScheduled(): void {
    if (this.timer) return;
    const wait = Math.max(0, MIN_INTERVAL_MS - (Date.now() - this.lastRequestAt));
    this.timer = setTimeout(() => this.tick(), wait);
  }

  private tick(): void {
    this.timer = null;
    const ownerId = this.rotation.shift();
    if (ownerId === undefined) return;
    const bucket = this.queues.get(ownerId);
    const run = bucket?.shift();
    if (bucket && bucket.length > 0) {
      this.rotation.push(ownerId);
    } else {
      this.queues.delete(ownerId);
    }
    this.lastRequestAt = Date.now();
    run?.();
    if (this.rotation.length > 0) this.ensureScheduled();
  }
}

const throttle = new FairThrottle();

export async function geocode(query: string, ownerId: string): Promise<GeoResult | null> {
  const key = query.trim().toLowerCase().replace(/\s+/g, " ");
  if (!key) return null;
  if (cache.has(key)) return cache.get(key) ?? null;

  const result = await throttle.schedule(ownerId, async () => {
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
