import { z } from "zod";
import { CURRENCIES } from "@tripplanner/shared";

const isHttpUrl = (url: string) => /^https?:\/\//i.test(url);
const httpUrl = z.string().refine(isHttpUrl, "La URL debe usar http o https");

export const tripStatusSchema = z.enum(["PLANNING", "BOOKED", "ONGOING", "COMPLETED", "CANCELLED"]);

export const tripSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  description: z.string().optional(),
  startDate: z.string().min(1, "La fecha de inicio es obligatoria"),
  endDate: z.string().min(1, "La fecha de fin es obligatoria"),
  currency: z.enum(CURRENCIES).default("EUR"),
  budget: z.string().optional(),
  coverImage: z.string().optional(),
});

export const flightSchema = z.object({
  airline: z.string().min(1),
  flightNumber: z.string().min(1),
  origin: z.string().min(1),
  destination: z.string().min(1),
  departureAt: z.string().min(1),
  arrivalAt: z.string().min(1),
  bookingRef: z.string().optional(),
  confirmationUrl: httpUrl.optional().or(z.literal("")),
  seatNumber: z.string().optional(),
  class: z.enum(["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"]).default("ECONOMY"),
  price: z.string().optional(),
  notes: z.string().optional(),
});

export const expenseSchema = z.object({
  category: z.enum(["FLIGHT", "ACCOMMODATION", "FOOD", "TRANSPORT", "ACTIVITY", "SHOPPING", "OTHER"]),
  description: z.string().min(1),
  amount: z.string().min(1),
  currency: z.enum(CURRENCIES).default("EUR"),
  date: z.string().min(1),
  paid: z.string().optional(),
  notes: z.string().optional(),
});

export const accommodationSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["HOTEL", "HOSTEL", "AIRBNB", "APARTMENT", "RESORT", "OTHER"]).default("HOTEL"),
  address: z.string().optional(),
  city: z.string().min(1),
  checkIn: z.string().min(1),
  checkOut: z.string().min(1),
  bookingRef: z.string().optional(),
  confirmationUrl: httpUrl.optional().or(z.literal("")),
  price: z.string().optional(),
  pricePerNight: z.string().optional(),
  notes: z.string().optional(),
});

export const activitySchema = z.object({
  name: z.string().min(1),
  type: z.enum(["ACTIVITY", "RESTAURANT", "MUSEUM", "TOUR", "TRANSPORT", "SHOW", "OTHER"]).default("ACTIVITY"),
  description: z.string().optional(),
  location: z.string().optional(),
  city: z.string().optional(),
  scheduledAt: z.string().optional(),
  duration: z.string().optional(),
  bookingRef: z.string().optional(),
  confirmationUrl: httpUrl.optional().or(z.literal("")),
  price: z.string().optional(),
  status: z.enum(["PENDING", "RESERVED", "CONFIRMED", "CANCELLED"]).default("PENDING"),
  notes: z.string().optional(),
});

export const documentSchema = z.object({
  type: z.enum(["PASSPORT", "VISA", "INSURANCE", "TICKET", "VOUCHER", "OTHER"]),
  name: z.string().min(1),
  fileUrl: httpUrl.optional().or(z.literal("")),
  expiresAt: z.string().optional(),
  notes: z.string().optional(),
});

export const packingItemSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  quantity: z.string().default("1"),
});

export const taskSchema = z.object({
  title: z.string().min(1, "El título es obligatorio"),
  notes: z.string().optional(),
  dueDate: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
});

export const unitSystemSchema = z.enum(["METRIC", "IMPERIAL"]);

export const profileSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio"),
  image: z.string().url("La URL de la imagen no es válida").optional().or(z.literal("")),
  unitSystem: unitSystemSchema.default("METRIC"),
});

export const diveSourceSchema = z.enum(["MANUAL", "IMPORTED"]);

export const gasMixSchema = z.enum(["AIR", "NITROX", "TRIMIX", "OXYGEN"]);

export const diveAreaSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  country: z.string().optional(),
  notes: z.string().optional(),
});

export const diveSiteSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  diveAreaId: z.string().optional(),
  address: z.string().optional(),
  country: z.string().optional(),
  region: z.string().optional(),
  notes: z.string().optional(),
});

export const diveLogSchema = z.object({
  tripId: z.string().optional(),
  diveSiteId: z.string().optional(),
  date: z.string().min(1, "La fecha es obligatoria"),
  time: z.string().optional(),
  depthMax: z.string().min(1, "La profundidad máxima es obligatoria"),
  bottomTime: z.string().min(1, "El tiempo de fondo es obligatorio"),
  surfaceInterval: z.string().optional(),
  gasMix: gasMixSchema.default("AIR"),
  o2Percentage: z.string().optional(),
  heliumPercentage: z.string().optional(),
  pressureStart: z.string().optional(),
  pressureEnd: z.string().optional(),
  waterTemp: z.string().optional(),
  airTemp: z.string().optional(),
  visibility: z.string().optional(),
  diveType: z.string().optional(),
  buddyName: z.string().optional(),
  suitType: z.string().optional(),
  weight: z.string().optional(),
  notes: z.string().optional(),
  rating: z
    .string()
    .optional()
    .refine(
      (v) => !v || (Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 5),
      "La valoración debe estar entre 1 y 5",
    ),
});

export const diveCertificationSchema = z.object({
  agency: z.string().min(1, "La entidad certificadora es obligatoria"),
  level: z.string().min(1, "El nivel es obligatorio"),
  certNumber: z.string().optional(),
  issueDate: z.string().optional(),
  instructorName: z.string().optional(),
  notes: z.string().optional(),
});

// ─── Diving Log (SQLite) import ─────────────────────────────────────────────
// Same string-shaped schemas as the manual dive forms above, extended with the
// provenance fields (externalId, site linkage) the import needs to resolve
// relations and dedupe on re-import. Reusing diveSiteSchema/diveLogSchema/
// diveCertificationSchema keeps this external-file boundary validated the
// same way as manual entry.

export const divingLogSiteSchema = diveSiteSchema.extend({
  externalId: z.string().min(1),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
});

export const divingLogEntrySchema = diveLogSchema.omit({ diveSiteId: true }).extend({
  externalId: z.string().min(1),
  diveSiteExternalId: z.string().nullable(),
});

export const divingLogCertificationSchema = diveCertificationSchema.extend({
  externalId: z.string().min(1),
});

const MAX_DIVING_LOG_IMPORT_ROWS = 5000;

export const divingLogImportPayloadSchema = z.object({
  sites: z.array(divingLogSiteSchema).max(MAX_DIVING_LOG_IMPORT_ROWS),
  logs: z.array(divingLogEntrySchema).max(MAX_DIVING_LOG_IMPORT_ROWS),
  certifications: z.array(divingLogCertificationSchema).max(MAX_DIVING_LOG_IMPORT_ROWS),
});

export type DivingLogImportPayload = z.infer<typeof divingLogImportPayloadSchema>;
