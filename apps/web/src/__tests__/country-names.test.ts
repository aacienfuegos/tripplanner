import { describe, it, expect } from "vitest";
import { countryNameToCode, countryCodeToName, countryOptions, isValidCountryCode } from "@tripplanner/shared";

describe("countryNameToCode", () => {
  it("resolves English country names (Diving Log's export language)", () => {
    expect(countryNameToCode("Spain")).toBe("ES");
    expect(countryNameToCode("Maldives")).toBe("MV");
    expect(countryNameToCode("Egypt")).toBe("EG");
  });

  it("resolves Spanish country names too", () => {
    expect(countryNameToCode("España")).toBe("ES");
    expect(countryNameToCode("Maldivas")).toBe("MV");
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(countryNameToCode("  spain  ")).toBe("ES");
    expect(countryNameToCode("SPAIN")).toBe("ES");
  });

  it("passes through an already-valid code unchanged", () => {
    expect(countryNameToCode("ES")).toBe("ES");
    expect(countryNameToCode("es")).toBe("ES");
  });

  it("returns null for unrecognized input instead of guessing", () => {
    expect(countryNameToCode("Narnia")).toBeNull();
    expect(countryNameToCode("")).toBeNull();
  });
});

describe("countryCodeToName", () => {
  it("resolves a code to its localized name", () => {
    expect(countryCodeToName("ES", "es")).toBe("España");
    expect(countryCodeToName("ES", "en")).toBe("Spain");
  });

  it("returns the raw value for an invalid code instead of throwing", () => {
    expect(countryCodeToName("XX", "es")).toBe("XX");
  });
});

describe("isValidCountryCode", () => {
  it("accepts real ISO 3166-1 alpha-2 codes", () => {
    expect(isValidCountryCode("ES")).toBe(true);
    expect(isValidCountryCode("MV")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isValidCountryCode("es")).toBe(false);
    expect(isValidCountryCode("Spain")).toBe(false);
    expect(isValidCountryCode("XX")).toBe(false);
  });
});

describe("countryOptions", () => {
  it("returns all 249 countries sorted by localized name", () => {
    const options = countryOptions("es");
    expect(options).toHaveLength(249);
    const names = options.map((o) => o.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "es")));
  });
});
