import { describe, it, expect } from "vitest";
import { BoundedCache } from "@/lib/bounded-cache";

describe("BoundedCache", () => {
  it("stores and retrieves values", () => {
    const cache = new BoundedCache<string, number>(3);
    cache.set("a", 1);
    expect(cache.get("a")).toBe(1);
    expect(cache.has("a")).toBe(true);
    expect(cache.has("b")).toBe(false);
  });

  it("evicts the oldest entry once maxSize is exceeded", () => {
    const cache = new BoundedCache<string, number>(3);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    expect(cache.size).toBe(3);

    cache.set("d", 4);

    expect(cache.size).toBe(3);
    expect(cache.has("a")).toBe(false);
    expect(cache.has("b")).toBe(true);
    expect(cache.has("c")).toBe(true);
    expect(cache.has("d")).toBe(true);
  });

  it("never grows past maxSize across many inserts", () => {
    const cache = new BoundedCache<number, number>(5);
    for (let i = 0; i < 100; i++) {
      cache.set(i, i * 2);
    }
    expect(cache.size).toBe(5);
    for (let i = 0; i < 95; i++) {
      expect(cache.has(i)).toBe(false);
    }
    for (let i = 95; i < 100; i++) {
      expect(cache.has(i)).toBe(true);
    }
  });

  it("re-inserting an existing key refreshes its recency without growing size", () => {
    const cache = new BoundedCache<string, number>(2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("a", 10);
    cache.set("c", 3);

    expect(cache.size).toBe(2);
    expect(cache.has("a")).toBe(true);
    expect(cache.get("a")).toBe(10);
    expect(cache.has("b")).toBe(false);
    expect(cache.has("c")).toBe(true);
  });
});
