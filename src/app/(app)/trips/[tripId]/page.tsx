import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Plane, Hotel, Star, FileText, DollarSign, ShoppingBag, MapPin, Calendar, Pencil
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { TripStatusBadge } from "@/components/trips/trip-status-badge";

export default async function TripDetailPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const session = await auth();
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      destinations: { orderBy: { order: "asc" } },
      _count: {
        select: {
          flights: true, accommodations: true, activities: true,
          documents: true, expenses: true, packingItems: true,
        },
      },
    },
  });

  if (!trip || trip.userId !== session!.user!.id) notFound();

  const duration = differenceInDays(trip.endDate, trip.startDate) + 1;

  const sections = [
    { href: "flights", label: "Vuelos", icon: Plane, count: trip._count.flights },
    { href: "accommodations", label: "Alojamiento", icon: Hotel, count: trip._count.accommodations },
    { href: "activities", label: "Actividades", icon: Star, count: trip._count.activities },
    { href: "documents", label: "Documentos", icon: FileText, count: trip._count.documents },
    { href: "expenses", label: "Gastos", icon: DollarSign, count: trip._count.expenses },
    { href: "packing", label: "Equipaje", icon: ShoppingBag, count: trip._count.packingItems },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{trip.name}</h1>
            <TripStatusBadge status={trip.status} />
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {format(trip.startDate, "d MMM", { locale: es })} —{" "}
              {format(trip.endDate, "d MMM yyyy", { locale: es })}
              <Badge variant="outline" className="ml-1 text-xs">{duration} días</Badge>
            </span>
            {trip.destinations.length > 0 && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {trip.destinations.map((d) => d.city).join(" → ")}
              </span>
            )}
            {trip.budget && (
              <span className="flex items-center gap-1">
                <DollarSign className="h-3.5 w-3.5" />
                Presupuesto: {trip.budget.toLocaleString()} {trip.currency}
              </span>
            )}
          </div>
          {trip.description && (
            <p className="text-sm text-muted-foreground">{trip.description}</p>
          )}
        </div>
        <Link
          href={`/trips/${trip.id}/edit`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <Pencil className="h-3.5 w-3.5 mr-1.5" />
          Editar
        </Link>
      </div>

      {/* Section cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {sections.map(({ href, label, icon: Icon, count }) => (
          <Link key={href} href={`/trips/${trip.id}/${href}`}>
            <Card className="hover:shadow-md hover:border-primary/50 transition-all cursor-pointer h-full">
              <CardContent className="pt-4 pb-3 flex flex-col items-center text-center gap-1.5">
                <Icon className="h-6 w-6 text-primary" />
                <p className="text-xs font-medium">{label}</p>
                <Badge variant="secondary" className="text-xs">{count}</Badge>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Destinations */}
      {trip.destinations.length > 0 && (
        <div>
          <h2 className="font-semibold mb-3">Itinerario de ciudades</h2>
          <div className="flex flex-col gap-2">
            {trip.destinations.map((dest, i) => (
              <div key={dest.id} className="flex items-center gap-3 text-sm">
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
                  {i + 1}
                </div>
                <div>
                  <span className="font-medium">{dest.city}</span>
                  <span className="text-muted-foreground">, {dest.country}</span>
                  <span className="text-muted-foreground ml-2">
                    {format(dest.arrivalDate, "d MMM", { locale: es })} —{" "}
                    {format(dest.departureDate, "d MMM", { locale: es })}
                    {" "}({differenceInDays(dest.departureDate, dest.arrivalDate)} noches)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
