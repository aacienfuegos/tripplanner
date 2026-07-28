import { describe, it, expect } from "vitest";
import { formatCurrency } from "@/lib/currency";

describe("formatCurrency", () => {
  it("formats EUR with the Spanish locale symbol and decimals", () => {
    expect(formatCurrency(45, "EUR", "es-ES")).toBe("45,00 €");
  });

  it("formats USD with the US locale symbol", () => {
    expect(formatCurrency(45, "USD", "en-US")).toBe("$45.00");
  });

  it("formats JPY without decimals (no minor unit)", () => {
    expect(formatCurrency(1500, "JPY", "en-US")).toBe("¥1,500");
  });

  it("defaults to en-US when no locale is given", () => {
    expect(formatCurrency(10, "EUR")).toBe("€10.00");
  });

  it("forwards extra Intl.NumberFormat options", () => {
    expect(formatCurrency(1234.56, "EUR", "en-US", { maximumFractionDigits: 0 })).toBe("€1,235");
  });
});
