import { describe, it, expect } from "vitest";
import {
  LIMITS,
  accommodationInputSchema,
  activityInputSchema,
  diveLogInputSchema,
  documentInputSchema,
  expenseInputSchema,
  flightInputSchema,
  packingItemInputSchema,
  tripInputSchema,
} from "@/lib/agent-schemas";
import { InputError, parseInput } from "@/lib/services/errors";

function failingField(run: () => unknown): string | undefined {
  try {
    run();
  } catch (error) {
    if (error instanceof InputError) return error.field;
    throw error;
  }
  return undefined;
}

const document = { type: "VISA", name: "Visado Japón", fileUrl: "https://example.com/visa.pdf", expiresAt: "2027-01-31" };

describe("agent schemas", () => {
  it("accepts a document with type, title, link, expiry and notes (CA8)", () => {
    expect(parseInput(documentInputSchema, { ...document, notes: "Original en la carpeta" })).toEqual({
      ...document,
      notes: "Original en la carpeta",
    });
  });

  it.each(["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,x", "//example.com", "ftp://example.com"])(
    "rejects the link %s with the field that fails (CA8)",
    (fileUrl) => {
      expect(failingField(() => parseInput(documentInputSchema, { ...document, fileUrl }))).toBe("fileUrl");
    },
  );

  it("rejects links in every section that has one, not only documents", () => {
    const flight = {
      airline: "Iberia",
      flightNumber: "IB6800",
      origin: "MAD",
      destination: "NRT",
      departureAt: "2026-06-07T12:30",
      arrivalAt: "2026-06-08T09:10",
    };
    expect(failingField(() => parseInput(flightInputSchema, { ...flight, confirmationUrl: "javascript:x" }))).toBe(
      "confirmationUrl",
    );
    expect(failingField(() => parseInput(tripInputSchema, { name: "J", startDate: "2026-06-07", endDate: "2026-06-21", coverImage: "javascript:x" }))).toBe(
      "coverImage",
    );
  });

  it("asks for the same fields as the web forms", () => {
    expect(failingField(() => parseInput(documentInputSchema, { type: "VISA" }))).toBe("name");
    expect(failingField(() => parseInput(accommodationInputSchema, { name: "Hotel", checkIn: "2026-06-07", checkOut: "2026-06-09" }))).toBe(
      "city",
    );
    expect(failingField(() => parseInput(expenseInputSchema, { category: "FOOD", description: "Cena", date: "2026-06-07" }))).toBe(
      "amount",
    );
    expect(failingField(() => parseInput(diveLogInputSchema, { date: "2026-08-01", depthMax: 18 }))).toBe("bottomTime");
  });

  it("only takes the enum values of the forms", () => {
    expect(failingField(() => parseInput(documentInputSchema, { ...document, type: "DRIVING_LICENSE" }))).toBe("type");
    expect(failingField(() => parseInput(expenseInputSchema, { category: "FOOD", description: "Cena", date: "2026-06-07", amount: 10, currency: "XXX" }))).toBe(
      "currency",
    );
  });

  it("takes numbers and booleans as such, not as text", () => {
    const expense = { category: "FOOD", description: "Cena", date: "2026-06-07" };

    expect(parseInput(expenseInputSchema, { ...expense, amount: 12.5, paid: true })).toMatchObject({ amount: 12.5, paid: true });
    expect(failingField(() => parseInput(expenseInputSchema, { ...expense, amount: "12.5" }))).toBe("amount");
    expect(failingField(() => parseInput(expenseInputSchema, { ...expense, amount: 1, paid: "true" }))).toBe("paid");
  });

  it("takes dates and times in the format of the forms, and real dates only", () => {
    const activity = { name: "Templo" };

    expect(parseInput(activityInputSchema, { ...activity, scheduledAt: "2026-06-09T10:00" })).toMatchObject({
      scheduledAt: "2026-06-09T10:00",
    });
    for (const scheduledAt of ["2026-06-09", "2026-06-09T25:00", "2026-06-09T10:00Z", "09/06/2026 10:00"]) {
      expect(failingField(() => parseInput(activityInputSchema, { ...activity, scheduledAt }))).toBe("scheduledAt");
    }
    expect(failingField(() => parseInput(documentInputSchema, { ...document, expiresAt: "2027-02-30" }))).toBe("expiresAt");
    expect(failingField(() => parseInput(diveLogInputSchema, { date: "2026-08-01", time: "9:5", depthMax: 18, bottomTime: 45 }))).toBe(
      "time",
    );
  });

  it("caps short texts, long texts, links and lists", () => {
    const tooLong = (n: number) => "x".repeat(n + 1);

    expect(failingField(() => parseInput(documentInputSchema, { ...document, name: tooLong(LIMITS.shortText) }))).toBe("name");
    expect(failingField(() => parseInput(documentInputSchema, { ...document, notes: tooLong(LIMITS.longText) }))).toBe("notes");
    expect(
      failingField(() => parseInput(documentInputSchema, { ...document, fileUrl: `https://e.com/${tooLong(LIMITS.url)}` })),
    ).toBe("fileUrl");
    expect(
      failingField(() =>
        parseInput(diveLogInputSchema, {
          date: "2026-08-01",
          depthMax: 18,
          bottomTime: 45,
          equipmentIds: Array.from({ length: LIMITS.list + 1 }, (_, i) => `eq-${i}`),
        }),
      ),
    ).toBe("equipmentIds");
    expect(parseInput(documentInputSchema, { ...document, name: "x".repeat(LIMITS.shortText) }).name).toHaveLength(
      LIMITS.shortText,
    );
  });

  it("adds no default on an edit, so a partial edit leaves the rest as stored", () => {
    expect(parseInput(flightInputSchema.partial(), { notes: "Ventanilla" })).toEqual({ notes: "Ventanilla" });
    expect(parseInput(activityInputSchema.partial(), {})).toEqual({});
  });

  it("drops a suitcaseId sent with a packing item: an agent doesn't choose the bag", () => {
    expect(parseInput(packingItemInputSchema, { name: "Linterna", category: "Varios", suitcaseId: "bag-1" })).toEqual({
      name: "Linterna",
      category: "Varios",
    });
  });
});
