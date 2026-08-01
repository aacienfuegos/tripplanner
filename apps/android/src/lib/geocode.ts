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
