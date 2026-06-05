import { z } from "zod";

// ─── Per-section import schemas ───────────────────────────────────────────────
// Intentionally lenient: prices are numbers, dates are ISO 8601 strings,
// and only the minimum required fields are mandatory so that partial or
// slightly incorrect AI responses still pass validation.
//
// When adding a new section, also update:
//   import-prompt.ts (SCHEMA block), import.ts (bulkImport + checkDuplicates),
//   ReviewStep.tsx (SECTION_CONFIG + ItemSummary), and the test file.

const optionalUrl = z.string().nullable().optional();

export const importFlightSchema = z.object({
  airline: z.string().min(1),
  flightNumber: z.string().min(1),
  origin: z.string().min(1),
  destination: z.string().min(1),
  departureAt: z.string().min(1),
  arrivalAt: z.string().min(1),
  bookingRef: z.string().nullable().optional(),
  confirmationUrl: optionalUrl,
  seatNumber: z.string().nullable().optional(),
  class: z.enum(["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"]).default("ECONOMY"),
  price: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const importAccommodationSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["HOTEL", "HOSTEL", "AIRBNB", "APARTMENT", "RESORT", "OTHER"]).default("HOTEL"),
  address: z.string().nullable().optional(),
  city: z.string().min(1),
  checkIn: z.string().min(1),
  checkOut: z.string().min(1),
  bookingRef: z.string().nullable().optional(),
  confirmationUrl: optionalUrl,
  price: z.number().nullable().optional(),
  pricePerNight: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const importActivitySchema = z.object({
  name: z.string().min(1),
  type: z.enum(["ACTIVITY", "RESTAURANT", "MUSEUM", "TOUR", "TRANSPORT", "SHOW", "OTHER"]).default("ACTIVITY"),
  description: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  scheduledAt: z.string().nullable().optional(),
  duration: z.number().int().positive().nullable().optional(),
  bookingRef: z.string().nullable().optional(),
  confirmationUrl: optionalUrl,
  price: z.number().nullable().optional(),
  status: z.enum(["PENDING", "RESERVED", "CONFIRMED", "CANCELLED"]).default("PENDING"),
  notes: z.string().nullable().optional(),
});

export const importExpenseSchema = z.object({
  description: z.string().min(1),
  category: z.enum(["FLIGHT", "ACCOMMODATION", "FOOD", "TRANSPORT", "ACTIVITY", "SHOPPING", "OTHER"]),
  amount: z.number().positive(),
  currency: z.string().default("EUR"),
  date: z.string().min(1),
  paid: z.boolean().default(false),
  notes: z.string().nullable().optional(),
});

export const importPackingItemSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  quantity: z.number().int().positive().default(1),
});

export const importDocumentSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["PASSPORT", "VISA", "INSURANCE", "TICKET", "VOUCHER", "OTHER"]),
  expiresAt: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

// ─── Root payload schema ──────────────────────────────────────────────────────

export const importPayloadSchema = z.object({
  flights:        z.array(importFlightSchema).optional().default([]),
  accommodations: z.array(importAccommodationSchema).optional().default([]),
  activities:     z.array(importActivitySchema).optional().default([]),
  expenses:       z.array(importExpenseSchema).optional().default([]),
  packing:        z.array(importPackingItemSchema).optional().default([]),
  documents:      z.array(importDocumentSchema).optional().default([]),
});

export type ImportPayload       = z.infer<typeof importPayloadSchema>;
export type ImportFlight        = z.infer<typeof importFlightSchema>;
export type ImportAccommodation = z.infer<typeof importAccommodationSchema>;
export type ImportActivity      = z.infer<typeof importActivitySchema>;
export type ImportExpense       = z.infer<typeof importExpenseSchema>;
export type ImportPackingItem   = z.infer<typeof importPackingItemSchema>;
export type ImportDocument      = z.infer<typeof importDocumentSchema>;
