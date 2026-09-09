import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, MapPin, Calendar, Plane } from "lucide-react";
import { format } from "date-fns";
import { es as esLocale, enUS } from "date-fns/locale";
import { TripStatusBadge } from "@/components/trips/trip-status-badge";
import { getT } from "@/lib/locale";

export default async function TripsPage() {
  const session = await auth();
  const [t, trips] = await Promise.all([
    getT(),
    prisma.trip.findMany({
      where: { userId: session!.user!.id! },
      include: {
        destinations: { orderBy: { order: "asc" } },
        _count: { select: { flights: true, accommodations: true, activities: true } },
      },
      orderBy: { startDate: "desc" },
    }),
  ]);

  const dfLocale = t.locale === "es" ? esLocale : enUS;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t.myTrips}</h1>
        <Link href="/trips/new" className={buttonVariants()}>
          <Plus className="h-4 w-4 mr-2" />
          {t.newTrip}
        </Link>
      </div>

      {trips.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Plane className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-2">{t.noTripsYet}</h3>
            <p className="text-muted-foreground text-sm mb-6">{t.noTripsYetHint}</p>
            <Link href="/trips/new" className={buttonVariants()}>
              <Plus className="h-4 w-4 mr-2" />
              {t.createFirstTrip}
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {trips.map((trip) => (
            <Link key={trip.id} href={`/trips/${trip.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="pt-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-base leading-tight">{trip.name}</h3>
                    <TripStatusBadge status={trip.status} locale={t.locale} />
                  </div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    {format(trip.startDate, "d MMM", { locale: dfLocale })} —{" "}
                    {format(trip.endDate, "d MMM yyyy", { locale: dfLocale })}
                  </p>
                  {trip.destinations.length > 0 && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      {trip.destinations.map((d) => d.city).join(" → ")}
                    </p>
                  )}
                  <div className="flex gap-4 pt-1 text-xs text-muted-foreground border-t">
                    <span className="flex items-center gap-1">
                      <Plane className="h-3 w-3" />
                      {trip._count.flights} {t.flights.toLowerCase()}
                    </span>
                    <span>{trip._count.accommodations} {t.accomAbbrev}</span>
                    <span>{trip._count.activities} {t.activAbbrev}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
