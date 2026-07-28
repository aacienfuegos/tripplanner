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
