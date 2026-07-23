import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SectionHeader } from "@/components/layout/section-header";
import { TripMapView, type MapPoint } from "@/components/map/TripMapView";
import { geocodeAccommodation, geocodeActivity } from "@/lib/geocode-items";
import { MapPin } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// Límite de items a geocodificar por carga: Nominatim va a ~1 req/s, así que
// el backfill se reparte entre varias visitas en vez de bloquear el render.
const BACKFILL_LIMIT = 12;

export default async function TripMapPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const session = await auth();

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      accommodations: {
        select: { id: true, name: true, city: true, address: true, checkIn: true, latitude: true, longitude: true },
        orderBy: { checkIn: "asc" },
      },
      activities: {
        select: { id: true, name: true, city: true, location: true, scheduledAt: true, latitude: true, longitude: true },
        orderBy: { scheduledAt: "asc" },
      },
    },
  });

  if (!trip || trip.userId !== session!.user!.id) notFound();

  const pending: Promise<void>[] = [];
  for (const a of trip.accommodations) {
    if (a.latitude === null && a.longitude === null && pending.length < BACKFILL_LIMIT) {
      pending.push(geocodeAccommodation(a.id));
    }
  }
  for (const a of trip.activities) {
    if (a.latitude === null && a.longitude === null && (a.location || a.city) && pending.length < BACKFILL_LIMIT) {
      pending.push(geocodeActivity(a.id));
    }
  }

  if (pending.length > 0) {
    await Promise.all(pending);
    const refreshed = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        accommodations: {
          select: { id: true, name: true, city: true, address: true, checkIn: true, latitude: true, longitude: true },
          orderBy: { checkIn: "asc" },
        },
        activities: {
          select: { id: true, name: true, city: true, location: true, scheduledAt: true, latitude: true, longitude: true },
          orderBy: { scheduledAt: "asc" },
        },
      },
    });
    if (refreshed) {
      trip.accommodations = refreshed.accommodations;
      trip.activities = refreshed.activities;
    }
  }

  const points: MapPoint[] = [];

  for (const a of trip.accommodations) {
    if (a.latitude === null || a.longitude === null) continue;
    points.push({
      id: a.id,
      kind: "accommodation",
      name: a.name,
      lat: a.latitude,
      lng: a.longitude,
      subtitle: a.city,
      date: a.checkIn ? a.checkIn.toISOString() : null,
      dateLabel: a.checkIn ? `Check-in ${format(a.checkIn, "d MMM", { locale: es })}` : null,
      detailHref: `/trips/${trip.id}/accommodations#${a.id}`,
    });
  }

  for (const a of trip.activities) {
    if (a.latitude === null || a.longitude === null) continue;
    points.push({
      id: a.id,
      kind: "activity",
      name: a.name,
      lat: a.latitude,
      lng: a.longitude,
      subtitle: a.location ?? a.city ?? null,
      date: a.scheduledAt ? a.scheduledAt.toISOString() : null,
      dateLabel: a.scheduledAt ? format(a.scheduledAt, "d MMM HH:mm", { locale: es }) : null,
      detailHref: `/trips/${trip.id}/activities#${a.id}`,
    });
  }

  const missing =
    trip.accommodations.filter((a) => a.latitude === null).length +
    trip.activities.filter((a) => a.latitude === null && (a.location || a.city)).length;

  return (
    <div className="space-y-6">
      <SectionHeader tripId={trip.id} tripName={trip.name} title="Mapa" icon={<MapPin className="h-5 w-5" />} />

      {points.length === 0 ? (
        <div className="border border-dashed rounded-lg p-10 text-center text-sm text-muted-foreground">
          <MapPin className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p>Aún no hay elementos geolocalizados en este viaje.</p>
          <p className="mt-1">
            Añade alojamientos o actividades con dirección o ciudad y aparecerán aquí en el mapa.
          </p>
        </div>
      ) : (
        <TripMapView points={points} pendingCount={missing} />
      )}
    </div>
  );
}
