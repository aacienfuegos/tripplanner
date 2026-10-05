import type { Prisma } from "@prisma/client";

// Lista cerrada de lo que devuelve /api/v1. Nunca salen userId ni tripId,
// bookingRef ni confirmationUrl (los enlaces de gestión suelen llevar el token
// de la reserva), el notes de actividades y alojamientos (instrucciones de
// check-in, códigos de acceso) ni el serialNumber y purchasePrice del equipo.

export const TRIP_LIST_SELECT = {
  id: true,
  name: true,
  startDate: true,
  endDate: true,
  status: true,
} as const satisfies Prisma.TripSelect;

export const DESTINATION_SELECT = {
  id: true,
  city: true,
  country: true,
  arrivalDate: true,
  departureDate: true,
  order: true,
  notes: true,
} as const satisfies Prisma.DestinationSelect;

export const ACTIVITY_SELECT = {
  id: true,
  name: true,
  type: true,
  description: true,
  location: true,
  city: true,
  scheduledAt: true,
  duration: true,
  price: true,
  status: true,
} as const satisfies Prisma.ActivitySelect;

export const ACCOMMODATION_SELECT = {
  id: true,
  name: true,
  type: true,
  address: true,
  city: true,
  checkIn: true,
  checkOut: true,
  price: true,
  pricePerNight: true,
} as const satisfies Prisma.AccommodationSelect;

export const TRIP_DETAIL_SELECT = {
  id: true,
  name: true,
  description: true,
  startDate: true,
  endDate: true,
  status: true,
  currency: true,
  destinations: { select: DESTINATION_SELECT },
  activities: { select: ACTIVITY_SELECT },
  accommodations: { select: ACCOMMODATION_SELECT },
} as const satisfies Prisma.TripSelect;

export const EQUIPMENT_SELECT = {
  id: true,
  name: true,
  category: true,
  brand: true,
  model: true,
  size: true,
  status: true,
  purchaseDate: true,
  lastServiceDate: true,
  serviceIntervalMonths: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.DiveEquipmentSelect;
