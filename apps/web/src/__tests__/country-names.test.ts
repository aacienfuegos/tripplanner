import { describe, it, expect } from "vitest";
import { normalizeCountryName } from "@/lib/country-names";

describe("normalizeCountryName", () => {
  it("translates English country names to their Spanish canonical form", () => {
    expect(normalizeCountryName("Spain")).toBe("España");
    expect(normalizeCountryName("Maldives")).toBe("Maldivas");
    expect(normalizeCountryName("Egypt")).toBe("Egipto");
    expect(normalizeCountryName("Morocco")).toBe("Marruecos");
    expect(normalizeCountryName("Japan")).toBe("Japón");
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(normalizeCountryName("  spain  ")).toBe("España");
    expect(normalizeCountryName("SPAIN")).toBe("España");
  });

  it("leaves already-Spanish names unchanged (they don't match the English lookup)", () => {
    expect(normalizeCountryName("España")).toBe("España");
  });

  it("leaves unrecognized input unchanged instead of throwing (best-effort)", () => {
    expect(normalizeCountryName("Narnia")).toBe("Narnia");
    expect(normalizeCountryName("")).toBe("");
  });
});
