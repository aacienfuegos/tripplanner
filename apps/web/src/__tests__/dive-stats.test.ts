import { describe, it, expect } from "vitest";
import { computeDiveStats, type DiveStatsInput } from "@/lib/dive-stats";

function dive(overrides: Partial<DiveStatsInput> = {}): DiveStatsInput {
  return {
    depthMax: 18,
    bottomTime: 45,
    waterTemp: 24,
    date: new Date("2024-06-01"),
    diveSite: { id: "site-1", name: "Cala Montgó", country: "España" },
    ...overrides,
  };
}

describe("computeDiveStats", () => {
  it("returns an empty-shaped result for no dives", () => {
    const stats = computeDiveStats([]);
    expect(stats.totalDives).toBe(0);
    expect(stats.maxDepth).toBeNull();
    expect(stats.avgDepth).toBeNull();
    expect(stats.avgWaterTemp).toBeNull();
    expect(stats.sitesVisitedCount).toBe(0);
    expect(stats.countriesVisitedCount).toBe(0);
    expect(stats.firstDiveDate).toBeNull();
    expect(stats.lastDiveDate).toBeNull();
    expect(stats.deepestDive).toBeNull();
    expect(stats.longestDive).toBeNull();
  });

  it("sums bottom time and counts dives", () => {
    const stats = computeDiveStats([dive({ bottomTime: 40 }), dive({ bottomTime: 50 })]);
    expect(stats.totalDives).toBe(2);
    expect(stats.totalBottomTimeMinutes).toBe(90);
  });

  it("computes max and average depth", () => {
    const stats = computeDiveStats([dive({ depthMax: 18 }), dive({ depthMax: 30 }), dive({ depthMax: 12 })]);
    expect(stats.maxDepth).toBe(30);
    expect(stats.avgDepth).toBeCloseTo(20, 5);
  });

  it("averages water temp only across dives that have it", () => {
    const stats = computeDiveStats([
      dive({ waterTemp: 20 }),
      dive({ waterTemp: null }),
      dive({ waterTemp: 24 }),
    ]);
    expect(stats.avgWaterTemp).toBeCloseTo(22, 5);
  });

  it("counts distinct sites and countries, ignoring dives with no site", () => {
    const stats = computeDiveStats([
      dive({ diveSite: { id: "site-1", name: "Cala Montgó", country: "España" } }),
      dive({ diveSite: { id: "site-1", name: "Cala Montgó", country: "España" } }), // repeat visit, same site
      dive({ diveSite: { id: "site-2", name: "Thistlegorm", country: "Egipto" } }),
      dive({ diveSite: null }),
    ]);
    expect(stats.sitesVisitedCount).toBe(2);
    expect(stats.countriesVisitedCount).toBe(2);
  });

  it("finds first and last dive dates regardless of input order", () => {
    const stats = computeDiveStats([
      dive({ date: new Date("2024-08-01") }),
      dive({ date: new Date("2024-01-15") }),
      dive({ date: new Date("2024-05-10") }),
    ]);
    expect(stats.firstDiveDate).toEqual(new Date("2024-01-15"));
    expect(stats.lastDiveDate).toEqual(new Date("2024-08-01"));
  });

  it("identifies the deepest dive with its site and date", () => {
    const stats = computeDiveStats([
      dive({ depthMax: 18, diveSite: { id: "site-1", name: "Cala Montgó", country: "España" }, date: new Date("2024-01-01") }),
      dive({ depthMax: 35, diveSite: { id: "site-2", name: "Thistlegorm", country: "Egipto" }, date: new Date("2024-05-05") }),
    ]);
    expect(stats.deepestDive).toEqual({ diveSiteName: "Thistlegorm", date: new Date("2024-05-05"), value: 35 });
  });

  it("identifies the longest dive with its site and date", () => {
    const stats = computeDiveStats([
      dive({ bottomTime: 40, diveSite: { id: "site-1", name: "Cala Montgó", country: "España" }, date: new Date("2024-01-01") }),
      dive({ bottomTime: 65, diveSite: { id: "site-2", name: "Thistlegorm", country: "Egipto" }, date: new Date("2024-05-05") }),
    ]);
    expect(stats.longestDive).toEqual({ diveSiteName: "Thistlegorm", date: new Date("2024-05-05"), value: 65 });
  });

  it("falls back to a null site name on records when the dive has no site", () => {
    const stats = computeDiveStats([dive({ diveSite: null, depthMax: 22 })]);
    expect(stats.deepestDive?.diveSiteName).toBeNull();
  });
});
