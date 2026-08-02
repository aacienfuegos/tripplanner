import iataAirports from "./data/iata-airports.json";

// Geocodificación directa contra Nominatim (OpenStreetMap), sin servidor
// intermedio — la app Android no tiene backend propio y sólo hay un usuario
// por dispositivo, así que no hace falta la cola de fairness de la web
// (apps/web/src/lib/geocoding.ts), pensada para muchos viajes/usuarios
// compitiendo por el límite de 1 req/s de Nominatim.
export interface GeocodeResult {
  latitude: number;
  longitude: number;
}

export async function geocodeQuery(query: string): Promise<GeocodeResult | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(trimmed)}`;
    const response = await fetch(url, {
      headers: { "User-Agent": "TripPlanner-Android/1.0 (personal use, single-device app)" },
    });
    if (!response.ok) return null;
    const results = (await response.json()) as Array<{ lat: string; lon: string }>;
    const first = results[0];
    if (!first) return null;
    return { latitude: parseFloat(first.lat), longitude: parseFloat(first.lon) };
  } catch {
    return null;
  }
}

const IATA_CODE_RE = /^[A-Z]{3}$/;

// Buscar un código IATA en texto libre vía Nominatim es poco fiable (p.ej.
// "RAK" de Marrakech pierde frente a una transcripción árabe coincidente en
// Dubái) — se resuelve primero contra el dataset de aeropuertos (OurAirports,
// dominio público, mismo JSON que usa la web) antes de recurrir a Nominatim.
export async function geocodeAirportText(text: string): Promise<GeocodeResult | null> {
  const code = text.trim().toUpperCase();
  if (IATA_CODE_RE.test(code)) {
    const coords = (iataAirports as unknown as Record<string, [number, number]>)[code];
    if (coords) return { latitude: coords[0], longitude: coords[1] };
  }
  return geocodeQuery(text);
}

export function accommodationGeocodeQuery(a: { name: string; address: string | null; city: string }): string {
  const anchor = a.address?.trim() || a.name;
  return [anchor, a.city].filter(Boolean).join(", ");
}

export function activityGeocodeQuery(a: { name: string; location: string | null; city: string | null }): string | null {
  const location = a.location?.trim();
  if (!location && !a.city) return null;
  return [location || a.name, a.city].filter(Boolean).join(", ");
}
