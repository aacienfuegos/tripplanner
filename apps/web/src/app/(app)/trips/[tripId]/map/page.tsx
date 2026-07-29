import { notFound } from "next/navigation";
import { after } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SectionHeader } from "@/components/layout/section-header";
import { getTripNavCounts } from "@/lib/trip-nav-counts";
import { TripMapView, type MapPoint, type FlightSegment } from "@/components/map/TripMapView";
import { geocodeAccommodation, geocodeActivity, geocodeFlight } from "@/lib/geocode-items";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin } from "lucide-react";
import { format } from "date-fns";
import { es, enUS } from "date-fns/locale";
import { getT } from "@/lib/locale";

// Límite de items a geocodificar por carga: Nominatim va a ~1 req/s, así que
// el backfill se reparte entre varias visitas en vez de bloquear el render.
//
// El backfill corre en after() (fuera del render, tras enviar la respuesta):
// esta visita pinta con las coordenadas ya persistidas y una visita
// posterior recoge las que se rellenen entretanto. Esto evita que el render
// de ESTE usuario se bloquee esperando la cola de geocoding (#185), pero la
// cola (`geocoding.ts`) sigue siendo un módulo global compartido por todo el
// proceso — el backfill de un usuario con muchos items sin geocodificar
// puede seguir retrasando el geocoding (no el render) de otros usuarios.
// Pendiente: cola/contexto de trabajo por-trip o por-usuario en vez de la
// cola FIFO global — ver comentario en el issue #185.
const BACKFILL_LIMIT = 12;

export default async function TripMapPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const [session, t] = await Promise.all([auth(), getT()]);
  const dateFnsLocale = t.locale === "es" ? es : enUS;

  const tripInclude = {
    accommodations: {
      select: { id: true, name: true, city: true, address: true, checkIn: true, latitude: true, longitude: true },
      orderBy: { checkIn: "asc" },
    },
    activities: {
      select: { id: true, name: true, city: true, location: true, scheduledAt: true, latitude: true, longitude: true },
      orderBy: { scheduledAt: "asc" },
    },
    flights: {
      select: {
        id: true,
        airline: true,
        flightNumber: true,
        origin: true,
        destination: true,
        originLat: true,
        originLng: true,
        destinationLat: true,
        destinationLng: true,
        departureAt: true,
        arrivalAt: true,
      },
      orderBy: { departureAt: "asc" },
    },
    diveLogs: {
      select: {
        id: true,
        date: true,
        diveNumber: true,
        diveSite: { select: { name: true, region: true, country: true, latitude: true, longitude: true } },
      },
      orderBy: { date: "asc" },
    },
  } as const;

  const trip = await prisma.trip.findUnique({ where: { id: tripId }, include: tripInclude });

  if (!trip || trip.userId !== session!.user!.id) notFound();

  const backfillIds: Array<() => Promise<void>> = [];
  for (const a of trip.accommodations) {
    if (a.latitude === null && a.longitude === null && backfillIds.length < BACKFILL_LIMIT) {
      backfillIds.push(() => geocodeAccommodation(a.id));
    }
  }
  for (const a of trip.activities) {
    if (a.latitude === null && a.longitude === null && (a.location || a.city) && backfillIds.length < BACKFILL_LIMIT) {
      backfillIds.push(() => geocodeActivity(a.id));
    }
  }
  for (const f of trip.flights) {
    if ((f.originLat === null || f.destinationLat === null) && backfillIds.length < BACKFILL_LIMIT) {
      backfillIds.push(() => geocodeFlight(f.id));
    }
  }

  if (backfillIds.length > 0) {
    // No await: el render pinta con lo ya persistido y el backfill corre
    // tras enviar la respuesta, sin bloquear a este usuario ni a otros
    // requests que compartan el proceso (#185).
    after(() => Promise.all(backfillIds.map((task) => task())));
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

  for (const d of trip.diveLogs) {
    if (!d.diveSite || d.diveSite.latitude === null || d.diveSite.longitude === null) continue;
    points.push({
      id: d.id,
      kind: "dive",
      name: d.diveSite.name,
      lat: d.diveSite.latitude,
      lng: d.diveSite.longitude,
      subtitle: [d.diveSite.region, d.diveSite.country].filter(Boolean).join(", ") || null,
      date: d.date.toISOString(),
      dateLabel: `#${d.diveNumber} · ${format(d.date, "d MMM", { locale: dateFnsLocale })}`,
      detailHref: `/dives#${d.id}`,
    });
  }

  const flightSegments: FlightSegment[] = [];
  for (const f of trip.flights) {
    if (f.originLat === null || f.originLng === null || f.destinationLat === null || f.destinationLng === null) continue;
    flightSegments.push({
      id: f.id,
      originName: f.origin,
      destinationName: f.destination,
      originLat: f.originLat,
      originLng: f.originLng,
      destinationLat: f.destinationLat,
      destinationLng: f.destinationLng,
      label: [f.airline, f.flightNumber].filter(Boolean).join(" "),
      dateLabel: f.departureAt ? format(f.departureAt, "d MMM HH:mm", { locale: dateFnsLocale }) : null,
      departureAt: f.departureAt ? f.departureAt.toISOString() : null,
      arrivalAt: f.arrivalAt ? f.arrivalAt.toISOString() : null,
      detailHref: `/trips/${trip.id}/flights#${f.id}`,
    });
  }

  const missing =
    trip.accommodations.filter((a) => a.latitude === null).length +
    trip.activities.filter((a) => a.latitude === null && (a.location || a.city)).length +
    trip.flights.filter((f) => f.originLat === null || f.destinationLat === null).length;

  const counts = await getTripNavCounts(trip.id);

  return (
    <div className="space-y-6">
      <SectionHeader tripId={trip.id} tripName={trip.name} title={t.sectionMap} tripsLabel={t.trips} icon={<MapPin className="h-5 w-5" />} counts={counts} />

      {points.length === 0 && flightSegments.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-muted-foreground">
            <MapPin className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <p>{t.noGeolocatedItems}</p>
            <p className="mt-1">{t.noGeolocatedItemsHint}</p>
          </CardContent>
        </Card>
      ) : (
        <TripMapView
          points={points}
          flights={flightSegments}
          pendingLabel={missing > 0 ? t.pendingGeolocation(missing) : null}
          labels={{ accommodation: t.accommodations, activity: t.activities, dive: t.dives, flight: t.flights, viewDetail: t.viewDetail }}
        />
      )}
    </div>
  );
}
