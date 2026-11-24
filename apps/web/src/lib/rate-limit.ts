import { BoundedCache } from "@/lib/bounded-cache";

export type RateLimitResult = { readonly limited: false } | { readonly limited: true; readonly retryAfterSeconds: number };

// Sliding window in memory. It is enough for today's single container; with
// several replicas it would have to move to the database (docs/tecnico.md).
// The number of keys is bounded, so a flood of new keys evicts the oldest
// instead of growing the heap.
export class RateLimiter {
  private readonly hits: BoundedCache<string, readonly number[]>;

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    maxKeys = 10_000,
  ) {
    this.hits = new BoundedCache(maxKeys);
  }

  private recent(key: string, now: number): readonly number[] {
    return (this.hits.get(key) ?? []).filter((at) => at > now - this.windowMs);
  }

  // Whether the key is over the limit, without counting this call.
  peek(key: string, now = Date.now()): RateLimitResult {
    const recent = this.recent(key, now);
    if (recent.length < this.limit) return { limited: false };
    return { limited: true, retryAfterSeconds: Math.max(1, Math.ceil((recent[0] + this.windowMs - now) / 1000)) };
  }

  record(key: string, now = Date.now()): void {
    this.hits.set(key, [...this.recent(key, now), now].slice(-this.limit));
  }

  // Counts the call and says whether it went over.
  hit(key: string, now = Date.now()): RateLimitResult {
    const result = this.peek(key, now);
    if (!result.limited) this.record(key, now);
    return result;
  }
}

// Behind Cloudflare and the router's proxy. It slows abuse down; it is not a
// security barrier (PKCE, single use and token entropy are).
export function clientIp(headers: Headers): string {
  return headers.get("cf-connecting-ip")?.trim() || headers.get("x-real-ip")?.trim() || "unknown";
}

export function tooManyRequests(retryAfterSeconds: number, headers: Record<string, string> = {}): Response {
  return Response.json(
    { error: "slow_down" },
    { status: 429, headers: { ...headers, "Retry-After": String(retryAfterSeconds) } },
  );
}
