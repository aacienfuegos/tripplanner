import { z } from "zod";
import { CURRENCIES } from "@tripplanner/shared";
import {
  accommodationTypeSchema,
  activityTypeSchema,
  bookingStatusSchema,
  countryCodeSchema,
  diveCurrentSchema,
  diveEntryTypeSchema,
  documentTypeSchema,
  equipmentCategorySchema,
  equipmentStatusSchema,
  expenseCategorySchema,
  flightClassSchema,
  gasMixSchema,
  isHttpUrl,
  taskPrioritySchema,
} from "@/lib/schemas";

// Typed input of the services. The web actions reach it from their form
// schemas; the MCP tools send it as it is. Same required fields and enums as
// the forms, plus limits the forms never had. The schemas packages/shared uses
// for the AI import are lax on purpose and don't do as a write contract.
//
// No field has a default: an edit is partial, and a default would overwrite
// what is stored with it. Creating relies on the defaults of the database.
// Dates are local time, as the forms send them, and go out in the same format.

export const LIMITS = { shortText: 200, longText: 5000, url: 2048, list: 100 } as const;

const requiredText = z.string().min(1, "Required").max(LIMITS.shortText);
const optionalText = z.string().max(LIMITS.shortText).nullish();
const longText = z.string().max(LIMITS.longText).nullish();
const link = z.string().max(LIMITS.url).refine(isHttpUrl, "The URL must use http or https").nullish();
const id = z.string().min(1).max(LIMITS.shortText);
const amount = z.number().nullish();
const count = z.number().int().nullish();

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

// The regexes allow 2026-02-30, which Date rolls over to March.
const isCalendarDay = (value: string) => {
  const day = value.slice(0, 10);
  const parsed = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day;
};

const day = z.string().regex(DATE, "Expected YYYY-MM-DD").refine(isCalendarDay, "Not a calendar date");
const dateTime = z
  .string()
  .regex(DATE_TIME, "Expected YYYY-MM-DDTHH:mm")
  .refine(isCalendarDay, "Not a calendar date");
const time = z.string().regex(TIME, "Expected HH:mm");

// ─── Trips ────────────────────────────────────────────────────────────────────

export const tripInputSchema = z.object({
  name: requiredText,
  description: longText,
  startDate: day,
  endDate: day,
  currency: z.enum(CURRENCIES).optional(),
  budget: amount,
  coverImage: link,
});

export const destinationInputSchema = z.object({
  city: requiredText,
  country: countryCodeSchema,
  arrivalDate: day,
  departureDate: day,
  notes: longText,
});

export const flightInputSchema = z.object({
  airline: requiredText,
  flightNumber: requiredText,
  origin: requiredText,
  destination: requiredText,
  departureAt: dateTime,
  arrivalAt: dateTime,
  bookingRef: optionalText,
  confirmationUrl: link,
  seatNumber: optionalText,
  class: flightClassSchema.optional(),
  price: amount,
  notes: longText,
});

export const accommodationInputSchema = z.object({
  name: requiredText,
  type: accommodationTypeSchema.optional(),
  address: optionalText,
  city: requiredText,
  checkIn: day,
  checkOut: day,
  bookingRef: optionalText,
  confirmationUrl: link,
  price: amount,
  pricePerNight: amount,
  notes: longText,
});

export const activityInputSchema = z.object({
  name: requiredText,
  type: activityTypeSchema.optional(),
  description: longText,
  location: optionalText,
  city: optionalText,
  scheduledAt: dateTime.nullish(),
  duration: count,
  bookingRef: optionalText,
  confirmationUrl: link,
  price: amount,
  status: bookingStatusSchema.optional(),
  notes: longText,
});

export const documentInputSchema = z.object({
  type: documentTypeSchema,
  name: requiredText,
  fileUrl: link,
  expiresAt: day.nullish(),
  notes: longText,
});

export const expenseInputSchema = z.object({
  category: expenseCategorySchema,
  description: requiredText,
  amount: z.number(),
  currency: z.enum(CURRENCIES).optional(),
  date: day,
  paid: z.boolean().optional(),
  notes: longText,
});

export const taskInputSchema = z.object({
  title: requiredText,
  notes: longText,
  dueDate: day.nullish(),
  priority: taskPrioritySchema.optional(),
});

// No suitcaseId: an agent doesn't choose a bag. It creates the item in "no
// bag" and an edit leaves its bag as it was. The web passes the bag apart.
export const packingItemInputSchema = z.object({
  name: z.string().trim().min(1, "Required").max(LIMITS.shortText),
  category: z.string().trim().min(1, "Required").max(LIMITS.shortText),
  quantity: z.number().int().min(1).max(9999).optional(),
});

// ─── Diving ───────────────────────────────────────────────────────────────────

export const diveAreaInputSchema = z.object({
  name: requiredText,
  country: countryCodeSchema.nullish(),
  notes: longText,
});

export const diveSiteInputSchema = z.object({
  name: requiredText,
  diveAreaId: id.nullish(),
  address: optionalText,
  country: countryCodeSchema.nullish(),
  region: optionalText,
  notes: longText,
});

export const diveLogInputSchema = z.object({
  tripId: id.nullish(),
  diveSiteId: id.nullish(),
  equipmentIds: z.array(id).max(LIMITS.list).optional(),
  date: day,
  time: time.nullish(),
  depthMax: z.number(),
  bottomTime: z.number().int(),
  surfaceInterval: count,
  gasMix: gasMixSchema.optional(),
  o2Percentage: count,
  heliumPercentage: count,
  pressureStart: count,
  pressureEnd: count,
  waterTemp: amount,
  airTemp: amount,
  visibility: amount,
  visibilityHorizontal: amount,
  diveType: optionalText,
  buddyName: optionalText,
  suitType: optionalText,
  weight: amount,
  notes: longText,
  rating: z.number().int().min(1).max(5).nullish(),
  current: diveCurrentSchema.nullish(),
  divemaster: optionalText,
  boat: optionalText,
  entryType: diveEntryTypeSchema.nullish(),
  decoRequired: z.boolean().optional(),
  safetyStopMinutes: count,
  minPpo2: amount,
  maxPpo2: amount,
  cnsPercent: count,
});

export const diveEquipmentInputSchema = z.object({
  name: requiredText,
  category: equipmentCategorySchema,
  status: equipmentStatusSchema.optional(),
  brand: optionalText,
  model: optionalText,
  size: optionalText,
  serialNumber: optionalText,
  purchaseDate: day.nullish(),
  purchasePrice: amount,
  lastServiceDate: day.nullish(),
  serviceIntervalMonths: count,
  notes: longText,
});

export const diveEquipmentServiceInputSchema = z.object({
  equipmentId: id,
  date: day,
  description: z.string().min(1, "Required").max(LIMITS.longText),
  cost: amount,
  notes: longText,
});

export const diveCertificationInputSchema = z.object({
  agency: requiredText,
  level: requiredText,
  certNumber: optionalText,
  issueDate: day.nullish(),
  instructorName: optionalText,
  notes: longText,
});

export type TripInput = z.infer<typeof tripInputSchema>;
export type DestinationInput = z.infer<typeof destinationInputSchema>;
export type FlightInput = z.infer<typeof flightInputSchema>;
export type AccommodationInput = z.infer<typeof accommodationInputSchema>;
export type ActivityInput = z.infer<typeof activityInputSchema>;
export type DocumentInput = z.infer<typeof documentInputSchema>;
export type ExpenseInput = z.infer<typeof expenseInputSchema>;
export type TaskInput = z.infer<typeof taskInputSchema>;
export type PackingItemInput = z.infer<typeof packingItemInputSchema>;
export type DiveAreaInput = z.infer<typeof diveAreaInputSchema>;
export type DiveSiteInput = z.infer<typeof diveSiteInputSchema>;
export type DiveLogInput = z.infer<typeof diveLogInputSchema>;
export type DiveEquipmentInput = z.infer<typeof diveEquipmentInputSchema>;
export type DiveEquipmentServiceInput = z.infer<typeof diveEquipmentServiceInputSchema>;
export type DiveCertificationInput = z.infer<typeof diveCertificationInputSchema>;
