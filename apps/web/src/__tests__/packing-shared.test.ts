import { describe, it, expect } from "vitest";
import {
  buildSuitcaseShareText,
  filterPackingItems,
  foldText,
  formatWeight,
  parseWeightInput,
  resolveSuitcaseNames,
  weightInputValue,
} from "@tripplanner/shared";

// packages/shared/packing.ts is also what Android runs, and Android has no
// tests in CI: these cover both apps.

describe("foldText", () => {
  it("ignores case, accents and surrounding spaces", () => {
    expect(foldText("Cámara")).toBe(foldText("camara"));
    expect(foldText("CABINA")).toBe(foldText(" cabina "));
  });

  it("keeps punctuation", () => {
    expect(foldText("Mochila (roja)")).not.toBe(foldText("Mochila roja"));
  });
});

describe("filterPackingItems (CA28)", () => {
  const items = [
    { name: "Cepillo de dientes", packed: true },
    { name: "Cargador de móvil", packed: false },
    { name: "Cámara", packed: 0 },
    { name: "Cable USB", packed: 1 },
  ];

  it("finds by part of the name, without case or accents", () => {
    expect(filterPackingItems(items, { query: "cepillo", onlyPending: false }).map((i) => i.name)).toEqual([
      "Cepillo de dientes",
    ]);
    expect(filterPackingItems(items, { query: "CARGADOR", onlyPending: false }).map((i) => i.name)).toEqual([
      "Cargador de móvil",
    ]);
    expect(filterPackingItems(items, { query: "camara", onlyPending: false }).map((i) => i.name)).toEqual(["Cámara"]);
  });

  it("an empty query keeps everything", () => {
    expect(filterPackingItems(items, { query: "  ", onlyPending: false })).toHaveLength(4);
  });

  it("only pending drops the packed ones, with booleans or 0/1", () => {
    expect(filterPackingItems(items, { query: "", onlyPending: true }).map((i) => i.name)).toEqual([
      "Cargador de móvil",
      "Cámara",
    ]);
  });

  it("combines the query and only pending", () => {
    expect(filterPackingItems(items, { query: "ca", onlyPending: true }).map((i) => i.name)).toEqual([
      "Cargador de móvil",
      "Cámara",
    ]);
  });
});

describe("resolveSuitcaseNames (CA17, CA18)", () => {
  const existing = [
    { id: "s-1", name: "Cabina" },
    { id: "s-2", name: "Maleta grande" },
  ];

  it("matches an existing bag with different case and accents", () => {
    const { matched, toCreate } = resolveSuitcaseNames(existing, ["cabína", "CABINA"]);

    expect(matched.get(foldText("Cabina"))).toBe("s-1");
    expect(toCreate).toEqual([]);
  });

  it("creates each new name once, spelled as it first appears", () => {
    const { toCreate } = resolveSuitcaseNames(existing, ["Mochila roja", "mochila ROJA", "Neceser", "cabina"]);

    expect(toCreate).toEqual(["Mochila roja", "Neceser"]);
  });

  it("skips missing and empty names", () => {
    const { matched, toCreate } = resolveSuitcaseNames(existing, [null, undefined, "", "  "]);

    expect(matched.size).toBe(0);
    expect(toCreate).toEqual([]);
  });
});

describe("parseWeightInput (CA2)", () => {
  it("an empty field is no weight", () => {
    expect(parseWeightInput("", "METRIC")).toEqual({ ok: true, grams: null });
    expect(parseWeightInput("  ", "IMPERIAL")).toEqual({ ok: true, grams: null });
  });

  it("accepts a comma or a dot as decimal separator", () => {
    expect(parseWeightInput("10,5", "METRIC")).toEqual({ ok: true, grams: 10500 });
    expect(parseWeightInput("10.5", "METRIC")).toEqual({ ok: true, grams: 10500 });
  });

  it("converts pounds to grams", () => {
    expect(parseWeightInput("22", "IMPERIAL")).toEqual({ ok: true, grams: 9979 });
  });

  it.each(["-1", "abc", "1e3", "10kg", "1001"])("rejects %s", (raw) => {
    expect(parseWeightInput(raw, "METRIC")).toEqual({ ok: false });
  });

  it("rejects more than 1000 kg in pounds too", () => {
    expect(parseWeightInput("2205", "IMPERIAL")).toEqual({ ok: false });
    expect(parseWeightInput("2204", "IMPERIAL")).toEqual({ ok: true, grams: Math.round(2204 * 453.59237) });
  });
});

describe("formatWeight (CA23)", () => {
  it("shows 10 kg as 22.0 lb after switching to imperial", () => {
    expect(formatWeight(10000, "METRIC", "es")).toBe("10,0 kg");
    expect(formatWeight(10000, "IMPERIAL", "es")).toBe("22,0 lb");
    expect(formatWeight(10000, "IMPERIAL", "en")).toBe("22.0 lb");
  });

  it("shows 22 lb as 10.0 kg after switching back to metric", () => {
    const { grams } = parseWeightInput("22", "IMPERIAL") as { ok: true; grams: number };

    expect(formatWeight(grams, "IMPERIAL", "es")).toBe("22,0 lb");
    expect(formatWeight(grams, "METRIC", "es")).toBe("10,0 kg");
  });
});

describe("weightInputValue", () => {
  it("fills the edit form with one decimal in the profile's unit", () => {
    expect(weightInputValue(9979, "IMPERIAL")).toBe("22.0");
    expect(weightInputValue(10000, "METRIC")).toBe("10.0");
    expect(weightInputValue(null, "METRIC")).toBe("");
  });
});

describe("buildSuitcaseShareText (CA38)", () => {
  it("lists the bag's items by category, with quantity and packed mark", () => {
    const text = buildSuitcaseShareText("Cabina", [
      { name: "Camiseta", category: "Ropa", quantity: 2, packed: false },
      { name: "Cepillo de dientes", category: "Aseo", quantity: 1, packed: true },
      { name: "Calcetines", category: "Ropa", quantity: 1, packed: 0 },
    ]);

    expect(text).toBe(
      ["Cabina", "Aseo", "- [x] Cepillo de dientes", "Ropa", "- [ ] Camiseta ×2", "- [ ] Calcetines"].join("\n"),
    );
  });
});
