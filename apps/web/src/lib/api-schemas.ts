import { z } from "zod";
import {
  accommodationTypeSchema,
  activityTypeSchema,
  bookingStatusSchema,
  equipmentCategorySchema,
  equipmentStatusSchema,
  httpUrl,
} from "@/lib/schemas";

// Tipos JSON nativos, a diferencia de schemas.ts (FormData, todo string).
// Las bases no llevan .default(): en Zod 4 .partial() conserva los defaults y
// un PATCH sin `type` lo devolvería a su valor por defecto.

const name = z.string().min(1).max(200);
const shortText = z.string().max(500).nullable().optional();
const longText = z.string().max(5000).nullable().optional();
const amount = z.number().nonnegative().nullable().optional();
const date = z.iso.date().nullable().optional();
const nonEmpty = (data: object) => Object.keys(data).length > 0;
const NON_EMPTY_MESSAGE = "At least one field is required";

// Se fijan al crear pero no se cambian por PATCH: así no se puede redirigir el
// enlace de una reserva existente ni sobrescribir unas notas que la API no devuelve.
const CREATE_ONLY = { bookingRef: true, confirmationUrl: true, notes: true } as const;

const activityBaseApiSchema = z
  .object({
    name,
    type: activityTypeSchema.optional(),
    description: longText,
    location: shortText,
    city: shortText,
    scheduledAt: z.iso.datetime({ local: true }).nullable().optional(),
    duration: z.number().int().positive().nullable().optional(),
    bookingRef: shortText,
    confirmationUrl: httpUrl.max(500).nullable().optional(),
    price: amount,
    status: bookingStatusSchema.optional(),
    notes: longText,
  })
  .strict();

export const activityCreateApiSchema = activityBaseApiSchema.extend({
  type: activityTypeSchema.default("ACTIVITY"),
  status: bookingStatusSchema.default("PENDING"),
});

export const activityUpdateApiSchema = activityBaseApiSchema
  .omit(CREATE_ONLY)
  .partial()
  .refine(nonEmpty, NON_EMPTY_MESSAGE);

const accommodationBaseApiSchema = z
  .object({
    name,
    type: accommodationTypeSchema.optional(),
    address: shortText,
    city: z.string().min(1).max(500),
    checkIn: date,
    checkOut: date,
    bookingRef: shortText,
    confirmationUrl: httpUrl.max(500).nullable().optional(),
    price: amount,
    pricePerNight: amount,
    notes: longText,
  })
  .strict();

export const accommodationCreateApiSchema = accommodationBaseApiSchema.extend({
  type: accommodationTypeSchema.default("HOTEL"),
});

export const accommodationUpdateApiSchema = accommodationBaseApiSchema
  .omit(CREATE_ONLY)
  .partial()
  .refine(nonEmpty, NON_EMPTY_MESSAGE);

const equipmentBaseApiSchema = z
  .object({
    name,
    category: equipmentCategorySchema,
    status: equipmentStatusSchema.optional(),
    brand: shortText,
    model: shortText,
    size: shortText,
    serialNumber: shortText,
    purchaseDate: date,
    purchasePrice: amount,
    lastServiceDate: date,
    serviceIntervalMonths: z.number().int().positive().nullable().optional(),
    notes: longText,
  })
  .strict();

export const equipmentCreateApiSchema = equipmentBaseApiSchema.extend({
  status: equipmentStatusSchema.default("OWNED"),
});

export const equipmentUpdateApiSchema = equipmentBaseApiSchema.partial().refine(nonEmpty, NON_EMPTY_MESSAGE);

// Convierte las fechas sin añadir claves ausentes: en un PATCH, una clave que
// no venía en el body no debe llegar a Prisma.
export function withDates<T extends Record<string, unknown>, K extends keyof T & string>(
  data: T,
  keys: readonly K[],
): Omit<T, K> & { [P in K]?: Date | null } {
  const converted = Object.fromEntries(
    keys
      .filter((key) => data[key] !== undefined)
      .map((key) => [key, data[key] === null ? null : new Date(data[key] as string)]),
  );
  return { ...data, ...converted } as Omit<T, K> & { [P in K]?: Date | null };
}
