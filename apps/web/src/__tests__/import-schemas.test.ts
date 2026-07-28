import { describe, it, expect } from "vitest";
import {
  importFlightSchema,
  importAccommodationSchema,
  importActivitySchema,
  importExpenseSchema,
  importPackingItemSchema,
  importDocumentSchema,
  importPayloadSchema,
} from "@tripplanner/shared";

// ─── importFlightSchema ───────────────────────────────────────────────────────

describe("importFlightSchema", () => {
  const valid = {
    airline: "Iberia",
    flightNumber: "IB3456",
    origin: "MAD",
    destination: "BCN",
    departureAt: "2026-06-15T07:30:00",
    arrivalAt: "2026-06-15T08:45:00",
  };

  it("accepts a minimal valid flight", () => {
    const result = importFlightSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.class).toBe("ECONOMY");
  });

  it("accepts a flight with numeric price", () => {
    const result = importFlightSchema.safeParse({ ...valid, price: 89.50 });
    expect(result.success).toBe(true);
  });

  it("accepts null for optional fields", () => {
    const result = importFlightSchema.safeParse({ ...valid, bookingRef: null, notes: null });
    expect(result.success).toBe(true);
  });

  it("rejects missing origin/destination (truly required fields)", () => {
    const { origin: _o, ...withoutOrigin } = valid;
    expect(importFlightSchema.safeParse(withoutOrigin).success).toBe(false);
    const { destination: _d, ...withoutDest } = valid;
    expect(importFlightSchema.safeParse(withoutDest).success).toBe(false);
  });

  it("accepts missing airline, flightNumber, departureAt, arrivalAt (planning fields)", () => {
    const { airline: _a, flightNumber: _f, departureAt: _dep, arrivalAt: _arr, ...minimal } = valid;
    expect(importFlightSchema.safeParse(minimal).success).toBe(true);
  });

  it("rejects invalid class enum", () => {
    expect(importFlightSchema.safeParse({ ...valid, class: "FIRST_CLASS" }).success).toBe(false);
  });

  it("accepts a valid https confirmationUrl", () => {
    const result = importFlightSchema.safeParse({ ...valid, confirmationUrl: "https://iberia.com/booking/123" });
    expect(result.success).toBe(true);
  });

  it("rejects javascript: URI for confirmationUrl (XSS)", () => {
    const result = importFlightSchema.safeParse({ ...valid, confirmationUrl: "javascript:alert(document.cookie)" });
    expect(result.success).toBe(false);
  });

  it("rejects data: URI for confirmationUrl (XSS)", () => {
    const result = importFlightSchema.safeParse({ ...valid, confirmationUrl: "data:text/html,<script>alert(1)</script>" });
    expect(result.success).toBe(false);
  });

  it("accepts all valid class values", () => {
    for (const cls of ["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"] as const) {
      expect(importFlightSchema.safeParse({ ...valid, class: cls }).success).toBe(true);
    }
  });
});

// ─── importAccommodationSchema ────────────────────────────────────────────────

describe("importAccommodationSchema", () => {
  const valid = {
    name: "Hotel Arts Barcelona",
    city: "Barcelona",
    checkIn: "2026-06-15T14:00:00",
    checkOut: "2026-06-18T12:00:00",
  };

  it("accepts a minimal valid accommodation", () => {
    const result = importAccommodationSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.type).toBe("HOTEL");
  });

  it("accepts numeric prices", () => {
    const result = importAccommodationSchema.safeParse({ ...valid, price: 750, pricePerNight: 250 });
    expect(result.success).toBe(true);
  });

  it("rejects missing city", () => {
    const { city: _c, ...without } = valid;
    expect(importAccommodationSchema.safeParse(without).success).toBe(false);
  });

  it("rejects javascript: URI for confirmationUrl (XSS)", () => {
    const result = importAccommodationSchema.safeParse({ ...valid, confirmationUrl: "javascript:alert(1)" });
    expect(result.success).toBe(false);
  });
});

// ─── importActivitySchema ─────────────────────────────────────────────────────

describe("importActivitySchema", () => {
  it("accepts a minimal valid activity with only a name", () => {
    const result = importActivitySchema.safeParse({ name: "Visita al Sagrada Família" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("ACTIVITY");
      expect(result.data.status).toBe("PENDING");
    }
  });

  it("accepts duration as an integer number", () => {
    const result = importActivitySchema.safeParse({ name: "Tour", duration: 120 });
    expect(result.success).toBe(true);
  });

  it("rejects non-integer duration", () => {
    const result = importActivitySchema.safeParse({ name: "Tour", duration: 1.5 });
    expect(result.success).toBe(false);
  });
});

// ─── importExpenseSchema ──────────────────────────────────────────────────────

describe("importExpenseSchema", () => {
  const valid = {
    description: "Cena en restaurante",
    category: "FOOD" as const,
    amount: 45.80,
    date: "2026-06-16T21:00:00",
  };

  it("accepts a minimal valid expense", () => {
    const result = importExpenseSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe("EUR");
      expect(result.data.paid).toBe(false);
    }
  });

  it("rejects zero or negative amount", () => {
    expect(importExpenseSchema.safeParse({ ...valid, amount: 0 }).success).toBe(false);
    expect(importExpenseSchema.safeParse({ ...valid, amount: -10 }).success).toBe(false);
  });

  it("rejects invalid category", () => {
    expect(importExpenseSchema.safeParse({ ...valid, category: "HOTEL" }).success).toBe(false);
  });

  it("accepts all valid categories", () => {
    const cats = ["FLIGHT", "ACCOMMODATION", "FOOD", "TRANSPORT", "ACTIVITY", "SHOPPING", "OTHER"] as const;
    for (const category of cats) {
      expect(importExpenseSchema.safeParse({ ...valid, category }).success).toBe(true);
    }
  });
});

// ─── importPackingItemSchema ──────────────────────────────────────────────────

describe("importPackingItemSchema", () => {
  const valid = { name: "Adaptador de corriente", category: "Electronics" };

  it("accepts a valid packing item", () => {
    const result = importPackingItemSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.quantity).toBe(1);
  });

  it("accepts a numeric quantity", () => {
    const result = importPackingItemSchema.safeParse({ ...valid, quantity: 3 });
    expect(result.success).toBe(true);
  });

  it("rejects zero or negative quantity", () => {
    expect(importPackingItemSchema.safeParse({ ...valid, quantity: 0 }).success).toBe(false);
  });
});

// ─── importDocumentSchema ─────────────────────────────────────────────────────

describe("importDocumentSchema", () => {
  it("accepts a minimal valid document", () => {
    const result = importDocumentSchema.safeParse({ name: "Pasaporte", type: "PASSPORT" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid type", () => {
    expect(importDocumentSchema.safeParse({ name: "DNI", type: "ID_CARD" }).success).toBe(false);
  });
});

// ─── importPayloadSchema ──────────────────────────────────────────────────────

describe("importPayloadSchema", () => {
  it("accepts an empty object and defaults all sections to empty arrays", () => {
    const result = importPayloadSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.flights).toEqual([]);
      expect(result.data.accommodations).toEqual([]);
      expect(result.data.activities).toEqual([]);
      expect(result.data.expenses).toEqual([]);
      expect(result.data.packing).toEqual([]);
      expect(result.data.documents).toEqual([]);
    }
  });

  it("accepts a realistic multi-section AI response", () => {
    const payload = {
      flights: [
        {
          airline: "Iberia",
          flightNumber: "IB3456",
          origin: "MAD",
          destination: "BCN",
          departureAt: "2026-06-15T07:30:00",
          arrivalAt: "2026-06-15T08:45:00",
          price: 89.50,
          bookingRef: "ABC123",
        },
      ],
      accommodations: [
        {
          name: "Hotel Arts",
          city: "Barcelona",
          checkIn: "2026-06-15T14:00:00",
          checkOut: "2026-06-18T12:00:00",
          pricePerNight: 250,
        },
      ],
      activities: [
        { name: "Sagrada Família", type: "MUSEUM", city: "Barcelona", price: 26 },
      ],
      expenses: [
        { description: "Vuelo MAD-BCN", category: "FLIGHT", amount: 89.50, date: "2026-06-15T00:00:00" },
      ],
    };
    const result = importPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.flights).toHaveLength(1);
      expect(result.data.accommodations).toHaveLength(1);
      expect(result.data.activities).toHaveLength(1);
      expect(result.data.expenses).toHaveLength(1);
      expect(result.data.packing).toEqual([]);
    }
  });

  it("rejects a flight with missing required fields inside the payload", () => {
    const payload = {
      flights: [{ airline: "Iberia" }], // missing flightNumber, origin, destination, dates
    };
    expect(importPayloadSchema.safeParse(payload).success).toBe(false);
  });
});
