import { describe, it, expect } from "vitest";
import {
  isDuplicateAccommodation,
  isDuplicateCertification,
  isDuplicateDestination,
  isDuplicateDive,
  isDuplicateDiveSiteOrArea,
  isDuplicateEquipment,
  isDuplicateEquipmentService,
  isDuplicateFlight,
  isDuplicateTask,
  isDuplicateTrip,
} from "@/lib/duplicates";

// Stored dates are built in local time, as new Date("…T…") stores them, so the
// tests don't depend on the time zone they run in.
const local = (s: string) => new Date(s);

describe("criteria of the AI import, unchanged", () => {
  it("flights: exact flight number and same day, or the day alone without a number", () => {
    const stored = { flightNumber: "IB 1234", departureAt: local("2026-06-07T12:30:00") };

    expect(isDuplicateFlight(stored, { flightNumber: "ib1234", departureAt: "2026-06-07T08:00" })).toBe(false);
    expect(isDuplicateFlight(stored, { flightNumber: "IB 1234", departureAt: "2026-06-07T08:00" })).toBe(true);
    expect(isDuplicateFlight(stored, { flightNumber: "IB 1235", departureAt: "2026-06-07T08:00" })).toBe(false);
    expect(isDuplicateFlight(stored, { flightNumber: null, departureAt: "2026-06-07" })).toBe(true);
  });

  it("accommodations: fuzzy name, and the day only if both have one", () => {
    const stored = { name: "Hotel Marriott", checkIn: local("2026-06-07T00:00:00") };

    expect(isDuplicateAccommodation(stored, { name: "Marriott Hotel", checkIn: "2026-06-07" })).toBe(true);
    expect(isDuplicateAccommodation(stored, { name: "Marriott Hotel" })).toBe(true);
    expect(isDuplicateAccommodation(stored, { name: "Marriott Hotel", checkIn: "2026-06-08" })).toBe(false);
  });
});

describe("criteria for the agents", () => {
  it("destination: same country, same city once normalized and same arrival day", () => {
    const stored = { city: "Kioto", country: "JP", arrivalDate: local("2026-06-10T00:00:00") };

    expect(isDuplicateDestination(stored, { city: "kioto ", country: "JP", arrivalDate: "2026-06-10" })).toBe(true);
    expect(isDuplicateDestination(stored, { city: "Kioto", country: "CN", arrivalDate: "2026-06-10" })).toBe(false);
    expect(isDuplicateDestination(stored, { city: "Kioto", country: "JP", arrivalDate: "2026-06-11" })).toBe(false);
    expect(isDuplicateDestination(stored, { city: "Kobe", country: "JP", arrivalDate: "2026-06-10" })).toBe(false);
  });

  it("task: fuzzy title and same due date, or both without one", () => {
    const dated = { title: "Comprar yenes", dueDate: local("2026-06-01T00:00:00") };
    const undated = { title: "Comprar yenes", dueDate: null };

    expect(isDuplicateTask(dated, { title: "comprar yenes", dueDate: "2026-06-01" })).toBe(true);
    expect(isDuplicateTask(dated, { title: "Comprar yenes", dueDate: "2026-06-02" })).toBe(false);
    expect(isDuplicateTask(dated, { title: "Comprar yenes" })).toBe(false);
    expect(isDuplicateTask(undated, { title: "Comprar yenes", dueDate: null })).toBe(true);
    expect(isDuplicateTask(undated, { title: "Reservar ryokan" })).toBe(false);
  });

  it("trip: fuzzy name and same start day", () => {
    const stored = { name: "Japón 2026", startDate: local("2026-06-07T00:00:00") };

    expect(isDuplicateTrip(stored, { name: "Japon 2026", startDate: "2026-06-07" })).toBe(true);
    expect(isDuplicateTrip(stored, { name: "Japón 2026", startDate: "2026-06-08" })).toBe(false);
  });

  it("dive: same day and time, or same day and site when it comes without a time", () => {
    const stored = { date: local("2026-08-01T10:30:00"), diveSiteId: "site-1" };

    expect(isDuplicateDive(stored, { date: "2026-08-01", time: "10:30" })).toBe(true);
    expect(isDuplicateDive(stored, { date: "2026-08-01", time: "15:00", diveSiteId: "site-1" })).toBe(false);
    expect(isDuplicateDive(stored, { date: "2026-08-01", diveSiteId: "site-1" })).toBe(true);
    expect(isDuplicateDive(stored, { date: "2026-08-01", diveSiteId: "site-2" })).toBe(false);
    expect(isDuplicateDive(stored, { date: "2026-08-02", time: "10:30" })).toBe(false);
  });

  it("site and area: fuzzy name, as the Diving Log import", () => {
    expect(isDuplicateDiveSiteOrArea({ name: "Bajo de Dentro" }, { name: "bajo de dentro" })).toBe(true);
    expect(isDuplicateDiveSiteOrArea({ name: "Bajo de Dentro" }, { name: "Bajo de Fuera" })).toBe(false);
  });

  it("equipment: fuzzy name and same category", () => {
    const stored = { name: "Traje semi-seco 5mm", category: "WETSUIT" };

    expect(isDuplicateEquipment(stored, { name: "traje semi seco 5mm", category: "WETSUIT" })).toBe(true);
    expect(isDuplicateEquipment(stored, { name: "Traje semi-seco 5mm", category: "OTHER" })).toBe(false);
  });

  it("equipment service: same equipment, same day and fuzzy description", () => {
    const stored = { equipmentId: "eq-1", date: local("2026-05-01T00:00:00"), description: "Revisión anual" };

    expect(isDuplicateEquipmentService(stored, { equipmentId: "eq-1", date: "2026-05-01", description: "revision anual" })).toBe(true);
    expect(isDuplicateEquipmentService(stored, { equipmentId: "eq-2", date: "2026-05-01", description: "Revisión anual" })).toBe(false);
    expect(isDuplicateEquipmentService(stored, { equipmentId: "eq-1", date: "2026-05-02", description: "Revisión anual" })).toBe(false);
  });

  it("certification: same agency and level once normalized", () => {
    const stored = { agency: "PADI", level: "Advanced Open Water" };

    expect(isDuplicateCertification(stored, { agency: "padi", level: "advanced open water" })).toBe(true);
    expect(isDuplicateCertification(stored, { agency: "SSI", level: "Advanced Open Water" })).toBe(false);
    expect(isDuplicateCertification(stored, { agency: "PADI", level: "Open Water" })).toBe(false);
  });
});
