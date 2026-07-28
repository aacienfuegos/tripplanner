import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SectionHeader } from "@/components/layout/section-header";
import { getTripNavCounts } from "@/lib/trip-nav-counts";
import { TripMapView, type MapPoint } from "@/components/map/TripMapView";
import { geocodeAccommodation, geocodeActivity } from "@/lib/geocode-items";
import { MapPin } from "lucide-react";
import { format } from "date-fns";
import { es, enUS } from "date-fns/locale";
import { getT } from "@/lib/locale";

// Límite de items a geocodificar por carga: Nominatim va a ~1 req/s, así que
// el backfill se reparte entre varias visitas en vez de bloquear el render.
const BACKFILL_LIMIT = 12;

export default async function TripMapPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const [session, t] = await Promise.all([auth(), getT()]);
  const dateFnsLocale = t.locale === "es" ? es : enUS;

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
      dateLabel: a.checkIn ? `${t.checkIn} ${format(a.checkIn, "d MMM", { locale: dateFnsLocale })}` : null,
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
      dateLabel: a.scheduledAt ? format(a.scheduledAt, "d MMM HH:mm", { locale: dateFnsLocale }) : null,
      detailHref: `/trips/${trip.id}/activities#${a.id}`,
    });
  }

  const missing =
    trip.accommodations.filter((a) => a.latitude === null).length +
    trip.activities.filter((a) => a.latitude === null && (a.location || a.city)).length;

  const counts = await getTripNavCounts(trip.id);

  return (
    <div className="space-y-6">
      <SectionHeader tripId={trip.id} tripName={trip.name} title={t.sectionMap} icon={<MapPin className="h-5 w-5" />} counts={counts} />

      {points.length === 0 ? (
        <div className="border border-dashed rounded-lg p-10 text-center text-sm text-muted-foreground">
          <MapPin className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p>{t.noGeolocatedItems}</p>
          <p className="mt-1">{t.noGeolocatedItemsHint}</p>
        </div>
      ) : (
        <TripMapView
          points={points}
          pendingLabel={missing > 0 ? t.pendingGeolocation(missing) : null}
          labels={{ accommodation: t.accommodations, activity: t.activities, viewDetail: t.viewDetail }}
        />
      )}
    </div>
  );
}
