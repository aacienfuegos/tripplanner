import { isFuzzyMatch, normalize } from "@/lib/fuzzy-match";

// Duplicate criteria, one per kind of element: is `candidate` already stored
// as `existing`? The AI import (checkDuplicates) uses the six of its sections;
// the agents' create tools, all of them. What is stored has Dates; what comes
// in has the dates as text, as the forms and the import send them.

type Day = Date | null;
type DayText = string | null | undefined;

// Use local-time components so the comparison is consistent with how
// new Date("2024-06-15T07:30:00") was parsed (local time) when storing.
// toISOString() returns UTC and would give the wrong day in non-UTC timezones.
const pad = (n: number) => String(n).padStart(2, "0");
const localDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const isoDay = (s: string) => s.slice(0, 10);

// A side with no date doesn't rule the match out.
const sameDayIfBoth = (existing: Day, candidate: DayText) =>
  !existing || !candidate || localDay(existing) === isoDay(candidate);

// Both without a date also counts as the same.
const sameDayOrBothNone = (existing: Day, candidate: DayText) =>
  existing && candidate ? localDay(existing) === isoDay(candidate) : !existing && !candidate;

// ─── The six sections of the AI import ────────────────────────────────────────

// Flight numbers must match exactly after normalization — "IB1234" ≠ "IB1235".
// If either side lacks a flight number, fall back to the date alone.
export function isDuplicateFlight(
  existing: { flightNumber: string | null; departureAt: Day },
  candidate: { flightNumber?: string | null; departureAt?: DayText },
): boolean {
  if (existing.flightNumber && candidate.flightNumber) {
    return (
      normalize(existing.flightNumber) === normalize(candidate.flightNumber) &&
      sameDayIfBoth(existing.departureAt, candidate.departureAt)
    );
  }
  return sameDayIfBoth(existing.departureAt, candidate.departureAt);
}

export function isDuplicateAccommodation(
  existing: { name: string; checkIn: Day },
  candidate: { name: string; checkIn?: DayText },
): boolean {
  return isFuzzyMatch(existing.name, candidate.name) && sameDayIfBoth(existing.checkIn, candidate.checkIn);
}

export function isDuplicateActivity(
  existing: { name: string; scheduledAt: Day },
  candidate: { name: string; scheduledAt?: DayText },
): boolean {
  return isFuzzyMatch(existing.name, candidate.name) && sameDayIfBoth(existing.scheduledAt, candidate.scheduledAt);
}

export function isDuplicateExpense(
  existing: { description: string; amount: number; date: Date },
  candidate: { description: string; amount: number; date: string },
): boolean {
  return (
    isFuzzyMatch(existing.description, candidate.description) &&
    existing.amount === candidate.amount &&
    localDay(existing.date) === isoDay(candidate.date)
  );
}

export function isDuplicatePackingItem(
  existing: { name: string; category: string },
  candidate: { name: string; category: string },
): boolean {
  return isFuzzyMatch(existing.name, candidate.name) && normalize(existing.category) === normalize(candidate.category);
}

export function isDuplicateDocument(
  existing: { name: string; type: string },
  candidate: { name: string; type: string },
): boolean {
  return isFuzzyMatch(existing.name, candidate.name) && normalize(existing.type) === normalize(candidate.type);
}

// ─── The rest, for the agents ─────────────────────────────────────────────────

export function isDuplicateDestination(
  existing: { city: string; country: string; arrivalDate: Date },
  candidate: { city: string; country: string; arrivalDate: string },
): boolean {
  return (
    existing.country === candidate.country &&
    normalize(existing.city) === normalize(candidate.city) &&
    localDay(existing.arrivalDate) === isoDay(candidate.arrivalDate)
  );
}

export function isDuplicateTask(
  existing: { title: string; dueDate: Day },
  candidate: { title: string; dueDate?: DayText },
): boolean {
  return isFuzzyMatch(existing.title, candidate.title) && sameDayOrBothNone(existing.dueDate, candidate.dueDate);
}

export function isDuplicateTrip(
  existing: { name: string; startDate: Date },
  candidate: { name: string; startDate: string },
): boolean {
  return isFuzzyMatch(existing.name, candidate.name) && localDay(existing.startDate) === isoDay(candidate.startDate);
}

// Same day and same time; with no time, same day and same site.
export function isDuplicateDive(
  existing: { date: Date; diveSiteId: string | null },
  candidate: { date: string; time?: string | null; diveSiteId?: string | null },
): boolean {
  if (localDay(existing.date) !== candidate.date) return false;
  if (candidate.time) return localTime(existing.date) === candidate.time;
  return existing.diveSiteId === (candidate.diveSiteId ?? null);
}

// Sites and areas, by name, as the Diving Log import does.
export function isDuplicateDiveSiteOrArea(existing: { name: string }, candidate: { name: string }): boolean {
  return isFuzzyMatch(existing.name, candidate.name);
}

export function isDuplicateEquipment(
  existing: { name: string; category: string },
  candidate: { name: string; category: string },
): boolean {
  return isFuzzyMatch(existing.name, candidate.name) && existing.category === candidate.category;
}

export function isDuplicateEquipmentService(
  existing: { equipmentId: string; date: Date; description: string },
  candidate: { equipmentId: string; date: string; description: string },
): boolean {
  return (
    existing.equipmentId === candidate.equipmentId &&
    localDay(existing.date) === isoDay(candidate.date) &&
    isFuzzyMatch(existing.description, candidate.description)
  );
}

export function isDuplicateCertification(
  existing: { agency: string; level: string },
  candidate: { agency: string; level: string },
): boolean {
  return normalize(existing.agency) === normalize(candidate.agency) && normalize(existing.level) === normalize(candidate.level);
}
