import "server-only";
import { prisma } from "@/lib/prisma";
import { geocode } from "@/lib/geocoding";
import iataAirports from "@/lib/data/iata-airports.json";

const IATA_CODE_RE = /^[A-Z]{3}$/;

// Buscar el código IATA en texto libre vía Nominatim es poco fiable: "RAK"
// (Marrakech) pierde por importancia frente a un lugar en Dubái cuyo nombre
// árabe transcribe igual. Los códigos de 3 letras se resuelven contra un
// dataset de aeropuertos (OurAirports, dominio público) antes de recurrir al
// geocoder genérico.
async function geocodeAirportText(text: string): Promise<{ lat: number; lng: number } | null> {
  const code = text.trim().toUpperCase();
  if (IATA_CODE_RE.test(code)) {
    const coords = (iataAirports as unknown as Record<string, [number, number]>)[code];
    if (coords) return { lat: coords[0], lng: coords[1] };
  }
  return geocode(text);
}

function accommodationQuery(a: { name: string; address: string | null; city: string }): string {
  const anchor = a.address?.trim() || a.name;
  return [anchor, a.city].filter(Boolean).join(", ");
}

function activityQuery(a: {
  name: string;
  location: string | null;
  city: string | null;
}): string | null {
  const location = a.location?.trim();
  // El nombre por sí solo es demasiado ambiguo; hace falta un ancla geográfica.
  if (!location && !a.city) return null;
  return [location || a.name, a.city].filter(Boolean).join(", ");
}

function diveSiteQuery(s: {
  name: string;
  address: string | null;
  region: string | null;
  country: string | null;
}): string {
  const anchor = s.address?.trim() || s.name;
  return [anchor, s.region, s.country].filter(Boolean).join(", ");
}

export async function geocodeAccommodation(id: string): Promise<void> {
  try {
    const a = await prisma.accommodation.findUnique({
      where: { id },
      select: { name: true, address: true, city: true },
    });
    if (!a) return;
    const result = await geocode(accommodationQuery(a));
    if (!result) return;
    await prisma.accommodation.update({
      where: { id },
      data: { latitude: result.lat, longitude: result.lng },
    });
  } catch {
    // El geocoding es un boundary externo best-effort: nunca debe romper el flujo.
  }
}

export async function geocodeActivity(id: string): Promise<void> {
  try {
    const a = await prisma.activity.findUnique({
      where: { id },
      select: { name: true, location: true, city: true },
    });
    if (!a) return;
    const query = activityQuery(a);
    if (!query) return;
    const result = await geocode(query);
    if (!result) return;
    await prisma.activity.update({
      where: { id },
      data: { latitude: result.lat, longitude: result.lng },
    });
  } catch {
    // El geocoding es un boundary externo best-effort: nunca debe romper el flujo.
  }
}

export async function geocodeDiveSite(id: string): Promise<void> {
  try {
    const s = await prisma.diveSite.findUnique({
      where: { id },
      select: { name: true, address: true, region: true, country: true },
    });
    if (!s) return;
    const result = await geocode(diveSiteQuery(s));
    if (!result) return;
    await prisma.diveSite.update({
      where: { id },
      data: { latitude: result.lat, longitude: result.lng },
    });
  } catch {
    // El geocoding es un boundary externo best-effort: nunca debe romper el flujo.
  }
}

export async function geocodeFlight(id: string): Promise<void> {
  try {
    const f = await prisma.flight.findUnique({
      where: { id },
      select: {
        origin: true,
        destination: true,
        originLat: true,
        originLng: true,
        destinationLat: true,
        destinationLng: true,
      },
    });
    if (!f) return;

    const [originResult, destinationResult] = await Promise.all([
      f.originLat === null ? geocodeAirportText(f.origin) : null,
      f.destinationLat === null ? geocodeAirportText(f.destination) : null,
    ]);

    await prisma.flight.update({
      where: { id },
      data: {
        ...(originResult && { originLat: originResult.lat, originLng: originResult.lng }),
        ...(destinationResult && {
          destinationLat: destinationResult.lat,
          destinationLng: destinationResult.lng,
        }),
      },
    });
  } catch {
    // El geocoding es un boundary externo best-effort: nunca debe romper el flujo.
  }
}
