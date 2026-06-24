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
});
