import type {
  Trip,
  Destination,
  Flight,
  Accommodation,
  Activity,
  Document,
  Expense,
  PackingItem,
  TripStatus,
  FlightClass,
  AccommodationType,
  ActivityType,
  BookingStatus,
  DocumentType,
  ExpenseCategory,
} from "@prisma/client";

export type {
  Trip,
  Destination,
  Flight,
  Accommodation,
  Activity,
  Document,
  Expense,
  PackingItem,
  TripStatus,
  FlightClass,
  AccommodationType,
  ActivityType,
  BookingStatus,
  DocumentType,
  ExpenseCategory,
};

export type TripWithDetails = Trip & {
  destinations: Destination[];
  flights: Flight[];
  accommodations: Accommodation[];
  activities: Activity[];
  documents: Document[];
  expenses: Expense[];
  packingItems: PackingItem[];
};

export type TripSummary = Trip & {
  destinations: Destination[];
  _count: {
    flights: number;
    accommodations: number;
    activities: number;
  };
};
