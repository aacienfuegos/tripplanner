import "server-only";
import { prisma } from "@/lib/prisma";
import { geocode } from "@/lib/geocoding";

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
