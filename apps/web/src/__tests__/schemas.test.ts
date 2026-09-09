import { describe, it, expect } from "vitest";
import {
  tripSchema,
  flightSchema,
  expenseSchema,
  accommodationSchema,
  activitySchema,
  documentSchema,
  packingItemSchema,
  taskSchema,
  profileSchema,
  unitSystemSchema,
  diveSiteSchema,
  diveLogSchema,
  diveCertificationSchema,
  diveSourceSchema,
  gasMixSchema,
  destinationSchema,
} from "@/lib/schemas";

// ─── Trip schema ──────────────────────────────────────────────────────────────

describe("tripSchema", () => {
  const valid = {
    name: "Japón 2026",
    startDate: "2026-06-07",
    endDate: "2026-06-21",
  };

  it("accepts a minimal valid trip", () => {
    const result = tripSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.currency).toBe("EUR");
  });

  it("rejects empty name", () => {
    const result = tripSchema.safeParse({ ...valid, name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing startDate", () => {
    const result = tripSchema.safeParse({ ...valid, startDate: "" });
    expect(result.success).toBe(false);
  });

  it("parses optional budget as string", () => {
    const result = tripSchema.safeParse({ ...valid, budget: "1500.50" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.budget).toBe("1500.50");
  });

  it("accepts a supported currency", () => {
    const result = tripSchema.safeParse({ ...valid, currency: "USD" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.currency).toBe("USD");
  });

  it("rejects an unsupported currency", () => {
    const result = tripSchema.safeParse({ ...valid, currency: "XXX" });
    expect(result.success).toBe(false);
  });

  it("rejects an arbitrary string as currency", () => {
    const result = tripSchema.safeParse({ ...valid, currency: "'; DROP TABLE trips;--" });
    expect(result.success).toBe(false);
  });
});

// ─── Flight schema ────────────────────────────────────────────────────────────

describe("flightSchema", () => {
  const valid = {
    airline: "Iberia",
    flightNumber: "IB6845",
    origin: "MAD",
    destination: "TYO",
    departureAt: "2026-06-07T10:00",
    arrivalAt: "2026-06-08T06:00",
  };

  it("accepts a minimal valid flight", () => {
    const result = flightSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.class).toBe("ECONOMY");
  });

  it("accepts a valid confirmation URL", () => {
    const result = flightSchema.safeParse({ ...valid, confirmationUrl: "https://iberia.com/booking/123" });
    expect(result.success).toBe(true);
  });

  it("accepts empty string for confirmationUrl", () => {
    const result = flightSchema.safeParse({ ...valid, confirmationUrl: "" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid URL for confirmationUrl", () => {
    const result = flightSchema.safeParse({ ...valid, confirmationUrl: "not-a-url" });
    expect(result.success).toBe(false);
  });

  it("rejects javascript: URI for confirmationUrl (XSS)", () => {
    const result = flightSchema.safeParse({ ...valid, confirmationUrl: "javascript:alert(document.cookie)" });
    expect(result.success).toBe(false);
  });

  it("rejects data: URI for confirmationUrl (XSS)", () => {
    const result = flightSchema.safeParse({ ...valid, confirmationUrl: "data:text/html,<script>alert(1)</script>" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid flight class", () => {
    const result = flightSchema.safeParse({ ...valid, class: "UNKNOWN" });
    expect(result.success).toBe(false);
  });
});

// ─── Expense schema ───────────────────────────────────────────────────────────

describe("expenseSchema", () => {
  const valid = {
    category: "FOOD" as const,
    description: "Ramen en Tokio",
    amount: "12.50",
    date: "2026-06-10",
  };

  it("accepts a minimal valid expense", () => {
    const result = expenseSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.currency).toBe("EUR");
  });

  it("rejects empty description", () => {
    const result = expenseSchema.safeParse({ ...valid, description: "" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid category", () => {
    const result = expenseSchema.safeParse({ ...valid, category: "INVALID" });
    expect(result.success).toBe(false);
  });

  it("accepts all valid categories", () => {
    const categories = ["FLIGHT", "ACCOMMODATION", "FOOD", "TRANSPORT", "ACTIVITY", "SHOPPING", "OTHER"] as const;
    for (const category of categories) {
      const result = expenseSchema.safeParse({ ...valid, category });
      expect(result.success, `category ${category} should be valid`).toBe(true);
    }
  });

  it("accepts all supported currencies", () => {
    const currencies = ["EUR", "USD", "GBP", "JPY", "MXN", "ARS", "CLP", "COP"] as const;
    for (const currency of currencies) {
      const result = expenseSchema.safeParse({ ...valid, currency });
      expect(result.success, `currency ${currency} should be valid`).toBe(true);
    }
  });

  it("rejects an unsupported currency", () => {
    const result = expenseSchema.safeParse({ ...valid, currency: "BTC" });
    expect(result.success).toBe(false);
  });
});

// ─── Accommodation schema ─────────────────────────────────────────────────────

describe("accommodationSchema", () => {
  const valid = {
    name: "Shinjuku Granbell Hotel",
    city: "Tokio",
    checkIn: "2026-06-07",
    checkOut: "2026-06-12",
  };

  it("accepts a minimal valid accommodation", () => {
    const result = accommodationSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.type).toBe("HOTEL");
  });

  it("rejects missing city", () => {
    const result = accommodationSchema.safeParse({ ...valid, city: "" });
    expect(result.success).toBe(false);
  });

  it("accepts a valid https confirmationUrl", () => {
    const result = accommodationSchema.safeParse({ ...valid, confirmationUrl: "https://booking.com/hotel/123" });
    expect(result.success).toBe(true);
  });

  it("rejects javascript: URI for confirmationUrl (XSS)", () => {
    const result = accommodationSchema.safeParse({ ...valid, confirmationUrl: "javascript:alert(1)" });
    expect(result.success).toBe(false);
  });
});

// ─── Activity schema ──────────────────────────────────────────────────────────

describe("activitySchema", () => {
  it("accepts a minimal valid activity", () => {
    const result = activitySchema.safeParse({ name: "Visita Senso-ji" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("ACTIVITY");
      expect(result.data.status).toBe("PENDING");
    }
  });

  it("rejects empty name", () => {
    const result = activitySchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("accepts a valid https confirmationUrl", () => {
    const result = activitySchema.safeParse({ name: "Tour", confirmationUrl: "https://getyourguide.com/tour/1" });
    expect(result.success).toBe(true);
  });

  it("rejects data: URI for confirmationUrl (XSS)", () => {
    const result = activitySchema.safeParse({ name: "Tour", confirmationUrl: "data:text/html,<script>alert(1)</script>" });
    expect(result.success).toBe(false);
  });
});

// ─── Document schema ──────────────────────────────────────────────────────────

describe("documentSchema", () => {
  const valid = { type: "PASSPORT" as const, name: "Pasaporte ES" };

  it("accepts a valid document", () => {
    const result = documentSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("rejects invalid document type", () => {
    const result = documentSchema.safeParse({ ...valid, type: "ID_CARD" });
    expect(result.success).toBe(false);
  });

  it("accepts a valid https fileUrl", () => {
    const result = documentSchema.safeParse({ ...valid, fileUrl: "https://drive.google.com/file/1" });
    expect(result.success).toBe(true);
  });

  it("rejects javascript: URI for fileUrl (XSS)", () => {
    const result = documentSchema.safeParse({ ...valid, fileUrl: "javascript:alert(document.cookie)" });
    expect(result.success).toBe(false);
  });
});

// ─── PackingItem schema ───────────────────────────────────────────────────────

describe("packingItemSchema", () => {
  const valid = { name: "Pasaporte", category: "Documentos" };

  it("accepts a valid packing item", () => {
    const result = packingItemSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.quantity).toBe("1");
  });

  it("rejects missing category", () => {
    const result = packingItemSchema.safeParse({ ...valid, category: "" });
    expect(result.success).toBe(false);
  });
});

// ─── Task schema ──────────────────────────────────────────────────────────────

describe("taskSchema", () => {
  it("accepts a minimal valid task", () => {
    const result = taskSchema.safeParse({ title: "Reservar hotel" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.priority).toBe("MEDIUM");
  });

  it("rejects empty title", () => {
    const result = taskSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
  });

  it("accepts all valid priorities", () => {
    for (const priority of ["LOW", "MEDIUM", "HIGH"] as const) {
      const result = taskSchema.safeParse({ title: "Tarea", priority });
      expect(result.success, `priority ${priority} should be valid`).toBe(true);
    }
  });

  it("rejects invalid priority", () => {
    const result = taskSchema.safeParse({ title: "Tarea", priority: "URGENT" });
    expect(result.success).toBe(false);
  });

  it("accepts optional dueDate and notes", () => {
    const result = taskSchema.safeParse({ title: "Tarea", dueDate: "2026-06-10", notes: "Llamar antes" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dueDate).toBe("2026-06-10");
      expect(result.data.notes).toBe("Llamar antes");
    }
  });
});

// ─── Profile schema ───────────────────────────────────────────────────────────

describe("profileSchema", () => {
  const valid = { name: "Andrés García" };

  it("accepts a minimal valid profile", () => {
    const result = profileSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = profileSchema.safeParse({ ...valid, name: "" });
    expect(result.success).toBe(false);
  });

  it("accepts a valid image URL", () => {
    const result = profileSchema.safeParse({ ...valid, image: "https://example.com/photo.jpg" });
    expect(result.success).toBe(true);
  });

  it("accepts empty string for image", () => {
    const result = profileSchema.safeParse({ ...valid, image: "" });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid image URL", () => {
    const result = profileSchema.safeParse({ ...valid, image: "not-a-url" });
    expect(result.success).toBe(false);
  });

  it("rejects whitespace-only name", () => {
    const result = profileSchema.safeParse({ ...valid, name: "   " });
    expect(result.success).toBe(false);
  });

  it("defaults unitSystem to METRIC when omitted", () => {
    const result = profileSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.unitSystem).toBe("METRIC");
  });

  it("accepts IMPERIAL as unitSystem", () => {
    const result = profileSchema.safeParse({ ...valid, unitSystem: "IMPERIAL" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.unitSystem).toBe("IMPERIAL");
  });

  it("rejects an invalid unitSystem value", () => {
    const result = profileSchema.safeParse({ ...valid, unitSystem: "KELVIN" });
    expect(result.success).toBe(false);
  });
});

// ─── unitSystemSchema ─────────────────────────────────────────────────────────

describe("unitSystemSchema", () => {
  it("accepts METRIC and IMPERIAL", () => {
    expect(unitSystemSchema.safeParse("METRIC").success).toBe(true);
    expect(unitSystemSchema.safeParse("IMPERIAL").success).toBe(true);
  });

  it("rejects any other value", () => {
    expect(unitSystemSchema.safeParse("metric").success).toBe(false);
    expect(unitSystemSchema.safeParse("").success).toBe(false);
  });
});

// ─── DiveSite schema ──────────────────────────────────────────────────────────

describe("diveSiteSchema", () => {
  it("accepts a minimal valid dive site", () => {
    const result = diveSiteSchema.safeParse({ name: "Cueva del Diablo" });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = diveSiteSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("accepts optional address, country and region", () => {
    const result = diveSiteSchema.safeParse({
      name: "Cueva del Diablo",
      address: "Cala del Diablo s/n",
      country: "ES",
      region: "Murcia",
      notes: "Corriente fuerte en marea baja",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a country that isn't a valid ISO 3166-1 alpha-2 code", () => {
    const result = diveSiteSchema.safeParse({ name: "Cueva del Diablo", country: "España" });
    expect(result.success).toBe(false);
  });
});

// ─── Destination schema ───────────────────────────────────────────────────────

describe("destinationSchema", () => {
  const valid = {
    city: "Kioto",
    country: "JP",
    arrivalDate: "2026-06-10",
    departureDate: "2026-06-15",
  };

  it("accepts a valid destination", () => {
    expect(destinationSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects empty city", () => {
    const result = destinationSchema.safeParse({ ...valid, city: "" });
    expect(result.success).toBe(false);
  });

  it("requires a country — unlike DiveSite/DiveArea, it isn't optional", () => {
    const { country: _country, ...withoutCountry } = valid;
    const result = destinationSchema.safeParse(withoutCountry);
    expect(result.success).toBe(false);
  });

  it("rejects a country that isn't a valid ISO 3166-1 alpha-2 code", () => {
    const result = destinationSchema.safeParse({ ...valid, country: "Japan" });
    expect(result.success).toBe(false);
  });

  it("rejects missing dates", () => {
    const { arrivalDate: _arrivalDate, ...withoutArrival } = valid;
    expect(destinationSchema.safeParse(withoutArrival).success).toBe(false);
  });
});

// ─── DiveLog schema ───────────────────────────────────────────────────────────

describe("diveLogSchema", () => {
  const valid = {
    date: "2026-06-10",
    depthMax: "28.5",
    bottomTime: "45",
    gasMix: "AIR" as const,
  };

  it("accepts a minimal valid dive log", () => {
    const result = diveLogSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.gasMix).toBe("AIR");
  });

  it("defaults gasMix to AIR when omitted", () => {
    const { gasMix: _gasMix, ...withoutGasMix } = valid;
    const result = diveLogSchema.safeParse(withoutGasMix);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.gasMix).toBe("AIR");
  });

  it("rejects missing date", () => {
    const result = diveLogSchema.safeParse({ ...valid, date: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing depthMax", () => {
    const result = diveLogSchema.safeParse({ ...valid, depthMax: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing bottomTime", () => {
    const result = diveLogSchema.safeParse({ ...valid, bottomTime: "" });
    expect(result.success).toBe(false);
  });

  it("accepts all valid gas mixes", () => {
    for (const gasMix of ["AIR", "NITROX", "TRIMIX", "OXYGEN"] as const) {
      const result = diveLogSchema.safeParse({ ...valid, gasMix });
      expect(result.success, `gasMix ${gasMix} should be valid`).toBe(true);
    }
  });

  it("rejects an invalid gas mix", () => {
    const result = diveLogSchema.safeParse({ ...valid, gasMix: "HELIOX" });
    expect(result.success).toBe(false);
  });

  it("accepts optional nitrox/trimix fields", () => {
    const result = diveLogSchema.safeParse({
      ...valid,
      gasMix: "TRIMIX",
      o2Percentage: "21",
      heliumPercentage: "35",
    });
    expect(result.success).toBe(true);
  });

  it("accepts optional tripId and diveSiteId", () => {
    const result = diveLogSchema.safeParse({ ...valid, tripId: "trip123", diveSiteId: "site123" });
    expect(result.success).toBe(true);
  });

  it("accepts diveType as free text, not restricted to a fixed catalog", () => {
    const result = diveLogSchema.safeParse({ ...valid, diveType: "Mountain Lake" });
    expect(result.success).toBe(true);
  });

  it("accepts a rating between 1 and 5", () => {
    for (const rating of ["1", "2", "3", "4", "5"]) {
      const result = diveLogSchema.safeParse({ ...valid, rating });
      expect(result.success, `rating ${rating} should be valid`).toBe(true);
    }
  });

  it("rejects a rating outside 1-5", () => {
    expect(diveLogSchema.safeParse({ ...valid, rating: "0" }).success).toBe(false);
    expect(diveLogSchema.safeParse({ ...valid, rating: "6" }).success).toBe(false);
  });

  it("rejects a non-integer rating", () => {
    const result = diveLogSchema.safeParse({ ...valid, rating: "3.5" });
    expect(result.success).toBe(false);
  });
});

// ─── DiveCertification schema ─────────────────────────────────────────────────

describe("diveCertificationSchema", () => {
  const valid = { agency: "PADI", level: "Open Water Diver" };

  it("accepts a minimal valid certification", () => {
    const result = diveCertificationSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("rejects empty agency", () => {
    const result = diveCertificationSchema.safeParse({ ...valid, agency: "" });
    expect(result.success).toBe(false);
  });

  it("rejects empty level", () => {
    const result = diveCertificationSchema.safeParse({ ...valid, level: "" });
    expect(result.success).toBe(false);
  });

  it("accepts optional certNumber, issueDate, instructorName and notes", () => {
    const result = diveCertificationSchema.safeParse({
      ...valid,
      certNumber: "ABC123",
      issueDate: "2020-05-01",
      instructorName: "Jane Doe",
      notes: "Curso en Tenerife",
    });
    expect(result.success).toBe(true);
  });
});

// ─── diveSourceSchema / gasMixSchema ──────────────────────────────────────────

describe("diveSourceSchema", () => {
  it("accepts MANUAL and IMPORTED", () => {
    expect(diveSourceSchema.safeParse("MANUAL").success).toBe(true);
    expect(diveSourceSchema.safeParse("IMPORTED").success).toBe(true);
  });

  it("rejects any other value", () => {
    expect(diveSourceSchema.safeParse("AUTO").success).toBe(false);
  });
});

describe("gasMixSchema", () => {
  it("accepts AIR, NITROX, TRIMIX and OXYGEN", () => {
    for (const mix of ["AIR", "NITROX", "TRIMIX", "OXYGEN"]) {
      expect(gasMixSchema.safeParse(mix).success).toBe(true);
    }
  });

  it("rejects an unsupported gas mix", () => {
    expect(gasMixSchema.safeParse("HELIOX").success).toBe(false);
  });
});
