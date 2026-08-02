import { diveLogSchema } from "@/lib/schemas";

// Shared between the manual dive form (src/actions/dives.ts) and the Diving Log
// logbook import (src/actions/dive-import.ts) — both end up with the same
// string-shaped diveLogSchema output and need the same Prisma field coercions.
export function mapDiveLogInput(data: ReturnType<typeof diveLogSchema.parse>, diveSiteId: string | null) {
  return {
    diveSiteId,
    date: new Date(`${data.date}T${data.time || "00:00"}:00`),
    depthMax: parseFloat(data.depthMax),
    bottomTime: parseInt(data.bottomTime, 10),
    surfaceInterval: data.surfaceInterval ? parseInt(data.surfaceInterval, 10) : null,
    gasMix: data.gasMix,
    o2Percentage: data.o2Percentage ? parseInt(data.o2Percentage, 10) : null,
    heliumPercentage: data.heliumPercentage ? parseInt(data.heliumPercentage, 10) : null,
    pressureStart: data.pressureStart ? parseInt(data.pressureStart, 10) : null,
    pressureEnd: data.pressureEnd ? parseInt(data.pressureEnd, 10) : null,
    waterTemp: data.waterTemp ? parseFloat(data.waterTemp) : null,
    airTemp: data.airTemp ? parseFloat(data.airTemp) : null,
    visibility: data.visibility ? parseFloat(data.visibility) : null,
    diveType: data.diveType || null,
    buddyName: data.buddyName || null,
    suitType: data.suitType || null,
    weight: data.weight ? parseFloat(data.weight) : null,
    notes: data.notes || null,
    rating: data.rating ? parseInt(data.rating, 10) : null,
    visibilityHorizontal: data.visibilityHorizontal ? parseFloat(data.visibilityHorizontal) : null,
    current: data.current || null,
    divemaster: data.divemaster || null,
    boat: data.boat || null,
    entryType: data.entryType || null,
    decoRequired: data.decoRequired === "on" || data.decoRequired === "1",
    safetyStopMinutes: data.safetyStopMinutes ? parseInt(data.safetyStopMinutes, 10) : null,
    minPpo2: data.minPpo2 ? parseFloat(data.minPpo2) : null,
    maxPpo2: data.maxPpo2 ? parseFloat(data.maxPpo2) : null,
    cnsPercent: data.cnsPercent ? parseInt(data.cnsPercent, 10) : null,
  };
}
