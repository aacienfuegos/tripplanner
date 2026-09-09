import type {
  Trip,
  Destination,
  Flight,
  Accommodation,
  Activity,
  Document,
  Expense,
  PackingItem,
  Task,
  TripStatus,
  FlightClass,
  AccommodationType,
  ActivityType,
  BookingStatus,
  DocumentType,
  ExpenseCategory,
  TaskPriority,
  DiveLog,
  DiveSite,
  DiveArea,
  DiveCertification,
  DiveEquipment,
  DiveEquipmentService,
  GasMix,
  DiveSource,
  EquipmentCategory,
  EquipmentStatus,
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
  Task,
  TripStatus,
  FlightClass,
  AccommodationType,
  ActivityType,
  BookingStatus,
  DocumentType,
  ExpenseCategory,
  TaskPriority,
  DiveLog,
  DiveSite,
  DiveArea,
  DiveCertification,
  DiveEquipment,
  DiveEquipmentService,
  GasMix,
  DiveSource,
  EquipmentCategory,
  EquipmentStatus,
};

export type DiveLogWithSite = DiveLog & { diveSite: DiveSite | null; equipment: DiveEquipment[] };
export type DiveSiteWithArea = DiveSite & { diveArea: DiveArea | null };
export type DiveAreaWithSites = DiveArea & { diveSites: DiveSite[] };
export type DiveEquipmentWithCount = DiveEquipment & { _count: { diveLogs: number } };

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
