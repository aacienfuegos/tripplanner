import { describe, it, expect } from "vitest";
import { en, es, getStrings } from "@/i18n";

describe("i18n dictionaries", () => {
  it("en and es expose the exact same set of keys", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort());
  });

  it("getStrings returns the matching dictionary for each locale", () => {
    expect(getStrings("es")).toBe(es);
    expect(getStrings("en")).toBe(en);
  });
});

// Regression test for #174: the countdown stat card used to derive its short
// label from `t.daysUntil(0).split(" ")[0]`, which produced the literal
// string "0" in English ("0 days to go" -> "0") instead of a label like "In".
describe("daysUntilLabel / daysAgoLabel (#174)", () => {
  it("provides dedicated short labels instead of deriving them from daysUntil(0)", () => {
    expect(en.daysUntilLabel).toBe("In");
    expect(en.daysAgoLabel).toBe("Ago");
    expect(es.daysUntilLabel).toBe("Faltan");
    expect(es.daysAgoLabel).toBe("Hace");
  });

  it("daysUntil(0) would still produce a misleading '0' if misused, proving the old hack was fragile", () => {
    expect(en.daysUntil(0).split(" ")[0]).toBe("0");
    // Spanish only "worked" by accident because the word order puts the label first.
    expect(es.daysUntil(0).split(" ")[0]).toBe("Faltan");
  });
});
