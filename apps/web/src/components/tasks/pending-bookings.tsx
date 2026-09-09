import Link from "next/link";
import { Plane, Hotel, Star, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Flight, Accommodation, Activity } from "@prisma/client";

type PendingFlight = Pick<Flight, "id" | "airline" | "flightNumber" | "origin" | "destination" | "bookingRef">;
type PendingAccommodation = Pick<Accommodation, "id" | "name" | "city" | "bookingRef">;
type PendingActivity = Pick<Activity, "id" | "name" | "status">;

interface PendingBookingsProps {
  tripId: string;
  flights: PendingFlight[];
  accommodations: PendingAccommodation[];
  activities: PendingActivity[];
}

export function PendingBookings({ tripId, flights, accommodations, activities }: PendingBookingsProps) {
  const pendingFlights = flights.filter((f) => !f.bookingRef);
  const pendingAccommodations = accommodations.filter((a) => !a.bookingRef);
  const pendingActivities = activities.filter((a) => a.status === "PENDING");

  const total = pendingFlights.length + pendingAccommodations.length + pendingActivities.length;
  if (total === 0) return null;

  return (
    <Card className="border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20">
      <CardContent className="py-3 px-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
          Pendientes de reservar
          <Badge variant="secondary" className="text-xs h-4 px-1">{total}</Badge>
        </div>
        <div className="space-y-1">
          {pendingFlights.map((f) => (
            <Link
              key={f.id}
              href={`/trips/${tripId}/flights#${f.id}`}
              className="flex items-center gap-2 text-xs py-1 px-2 rounded hover:bg-amber-100/60 dark:hover:bg-amber-900/30 transition-colors"
            >
              <Plane className="h-3 w-3 text-amber-600 shrink-0" />
              <span className="truncate">
                {f.airline ?? "Vuelo"} {f.flightNumber ?? ""} · {f.origin} → {f.destination}
              </span>
            </Link>
          ))}
          {pendingAccommodations.map((a) => (
            <Link
              key={a.id}
              href={`/trips/${tripId}/accommodations#${a.id}`}
              className="flex items-center gap-2 text-xs py-1 px-2 rounded hover:bg-amber-100/60 dark:hover:bg-amber-900/30 transition-colors"
            >
              <Hotel className="h-3 w-3 text-amber-600 shrink-0" />
              <span className="truncate">{a.name}{a.city ? ` · ${a.city}` : ""}</span>
            </Link>
          ))}
          {pendingActivities.map((a) => (
            <Link
              key={a.id}
              href={`/trips/${tripId}/activities#${a.id}`}
              className="flex items-center gap-2 text-xs py-1 px-2 rounded hover:bg-amber-100/60 dark:hover:bg-amber-900/30 transition-colors"
            >
              <Star className="h-3 w-3 text-amber-600 shrink-0" />
              <span className="truncate">{a.name}</span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
