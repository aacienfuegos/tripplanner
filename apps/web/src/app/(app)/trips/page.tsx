import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, MapPin, Calendar, Plane } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { TripStatusBadge } from "@/components/trips/trip-status-badge";

export default async function TripsPage() {
  const session = await auth();
  const trips = await prisma.trip.findMany({
    where: { userId: session!.user!.id! },
    include: {
      destinations: { orderBy: { order: "asc" } },
      _count: { select: { flights: true, accommodations: true, activities: true } },
    },
    orderBy: { startDate: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mis viajes</h1>
        <Link href="/trips/new" className={buttonVariants()}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo viaje
        </Link>
      </div>

      {trips.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Plane className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-2">Aún no tienes viajes</h3>
            <p className="text-muted-foreground text-sm mb-6">
              Crea tu primer viaje para empezar a organizarlo.
            </p>
            <Link href="/trips/new" className={buttonVariants()}>
              <Plus className="h-4 w-4 mr-2" />
              Crear viaje
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
                    <TripStatusBadge status={trip.status} />
                  </div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    {format(trip.startDate, "d MMM", { locale: es })} —{" "}
                    {format(trip.endDate, "d MMM yyyy", { locale: es })}
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
                      {trip._count.flights} vuelo{trip._count.flights !== 1 ? "s" : ""}
                    </span>
                    <span>{trip._count.accommodations} aloj.</span>
                    <span>{trip._count.activities} activ.</span>
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
