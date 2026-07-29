import { diveLogSchema } from "@/lib/schemas";

// Shared between the manual dive form (src/actions/dives.ts) and the Diving Log
// logbook import (src/actions/dive-import.ts) — both end up with the same
// string-shaped diveLogSchema output and need the same Prisma field coercions.
export function mapDiveLogInput(data: ReturnType<typeof diveLogSchema.parse>, diveSiteId: string | null) {
  return {
    diveSiteId,
    date: new Date(data.date),
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
  };
}
