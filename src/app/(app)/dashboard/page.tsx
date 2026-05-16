import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plane, Hotel, Calendar, MapPin, Plus, TrendingUp } from "lucide-react";
import { format, differenceInDays, isFuture, isPast } from "date-fns";
import { es } from "date-fns/locale";
import { TripStatusBadge } from "@/components/trips/trip-status-badge";
import { cn } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const [trips, upcomingFlights, upcomingAccommodations] = await Promise.all([
    prisma.trip.findMany({
      where: { userId },
      include: {
        destinations: true,
        _count: { select: { flights: true, accommodations: true, activities: true } },
      },
      orderBy: { startDate: "asc" },
      take: 6,
    }),
    prisma.flight.findMany({
      where: { trip: { userId }, departureAt: { gte: new Date() } },
      include: { trip: { select: { name: true } } },
      orderBy: { departureAt: "asc" },
      take: 3,
    }),
    prisma.accommodation.findMany({
      where: { trip: { userId }, checkIn: { gte: new Date() } },
      include: { trip: { select: { name: true } } },
      orderBy: { checkIn: "asc" },
      take: 3,
    }),
  ]);

  const activeTrip = trips.find((t) => !isPast(t.endDate) && !isFuture(t.startDate));
  const nextTrip = trips.find((t) => isFuture(t.startDate));
  const stats = {
    total: trips.length,
    upcoming: trips.filter((t) => isFuture(t.startDate)).length,
    ongoing: trips.filter((t) => !isPast(t.endDate) && !isFuture(t.startDate)).length,
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Hola, {session?.user?.name?.split(" ")[0] ?? "viajero"} 👋
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {stats.total === 0
              ? "Empieza creando tu primer viaje"
              : `Tienes ${stats.total} viaje${stats.total > 1 ? "s" : ""} registrado${stats.total > 1 ? "s" : ""}`}
          </p>
        </div>
        <Link href="/trips/new" className={buttonVariants()}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo viaje
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total viajes</CardTitle>
            <Plane className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Próximos</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.upcoming}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">En curso</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.ongoing}</div></CardContent>
        </Card>
      </div>

      {/* Active or next trip highlight */}
      {(activeTrip ?? nextTrip) && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base font-medium text-muted-foreground">
              {activeTrip ? "Viaje en curso" : "Próximo viaje"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const trip = (activeTrip ?? nextTrip)!;
              const daysUntil = differenceInDays(trip.startDate, new Date());
              return (
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold">{trip.name}</h2>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {format(trip.startDate, "d MMM", { locale: es })} —{" "}
                      {format(trip.endDate, "d MMM yyyy", { locale: es })}
                      {!activeTrip && daysUntil > 0 && (
                        <Badge variant="secondary" className="ml-2">En {daysUntil} días</Badge>
                      )}
                    </p>
                    {trip.destinations.length > 0 && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {trip.destinations.map((d) => d.city).join(" → ")}
                      </p>
                    )}
                  </div>
                  <Link
                    href={`/trips/${trip.id}`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    Ver viaje
                  </Link>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Próximos vuelos</CardTitle>
            <Plane className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {upcomingFlights.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay vuelos próximos.</p>
            ) : (
              <div className="space-y-3">
                {upcomingFlights.map((f) => (
                  <div key={f.id} className="text-sm">
                    <p className="font-medium">{f.origin} → {f.destination}</p>
                    <p className="text-muted-foreground text-xs">
                      {f.airline} {f.flightNumber} · {format(f.departureAt, "d MMM, HH:mm", { locale: es })}
                    </p>
                    <p className="text-muted-foreground text-xs">{f.trip.name}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Próximos alojamientos</CardTitle>
            <Hotel className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {upcomingAccommodations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay alojamientos próximos.</p>
            ) : (
              <div className="space-y-3">
                {upcomingAccommodations.map((a) => (
                  <div key={a.id} className="text-sm">
                    <p className="font-medium">{a.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {a.city} · Check-in {format(a.checkIn, "d MMM", { locale: es })}
                    </p>
                    <p className="text-muted-foreground text-xs">{a.trip.name}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {trips.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Mis viajes</h2>
            <Link href="/trips" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Ver todos
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {trips.map((trip) => (
              <Link key={trip.id} href={`/trips/${trip.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold leading-tight">{trip.name}</h3>
                      <TripStatusBadge status={trip.status} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {format(trip.startDate, "d MMM", { locale: es })} —{" "}
                      {format(trip.endDate, "d MMM yyyy", { locale: es })}
                    </p>
                    {trip.destinations.length > 0 && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3" />
                        {trip.destinations.map((d) => d.city).join(", ")}
                      </p>
                    )}
                    <div className="flex gap-3 mt-3 text-xs text-muted-foreground">
                      <span>{trip._count.flights} vuelo{trip._count.flights !== 1 ? "s" : ""}</span>
                      <span>{trip._count.accommodations} aloj.</span>
                      <span>{trip._count.activities} activ.</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {trips.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Plane className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-2">Planifica tu primer viaje</h3>
            <p className="text-muted-foreground text-sm mb-6 max-w-sm">
              Organiza vuelos, alojamientos, actividades, presupuesto y mucho más en un solo lugar.
            </p>
            <Link href="/trips/new" className={buttonVariants()}>
              <Plus className="h-4 w-4 mr-2" />
              Crear viaje
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
