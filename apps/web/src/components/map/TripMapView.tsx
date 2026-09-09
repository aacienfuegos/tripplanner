"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

export type MapPoint = {
  readonly id: string;
  readonly kind: "accommodation" | "activity" | "dive";
  readonly name: string;
  readonly lat: number;
  readonly lng: number;
  readonly subtitle: string | null;
  readonly date: string | null;
  readonly dateLabel: string | null;
  readonly detailHref: string;
};

export type FlightSegment = {
  readonly id: string;
  readonly originName: string;
  readonly destinationName: string;
  readonly originLat: number;
  readonly originLng: number;
  readonly destinationLat: number;
  readonly destinationLng: number;
  readonly label: string;
  readonly dateLabel: string | null;
  readonly departureAt: string | null;
  readonly arrivalAt: string | null;
  readonly detailHref: string;
};

export type MapLabels = {
  readonly accommodation: string;
  readonly activity: string;
  readonly dive: string;
  readonly flight: string;
  readonly viewDetail: string;
};

// Leaflet toca window/document en import: se carga solo en cliente (ssr: false),
// lo que sólo es válido dentro de un Client Component en Next.js 16.
const TripMap = dynamic(() => import("./TripMap").then((m) => m.TripMap), {
  ssr: false,
  loading: () => <Skeleton className="h-[70vh] w-full rounded-lg" />,
});

export function TripMapView({
  points,
  flights,
  pendingLabel,
  labels,
}: {
  points: readonly MapPoint[];
  flights: readonly FlightSegment[];
  pendingLabel: string | null;
  labels: MapLabels;
}) {
  return (
    <div className="space-y-2">
      <TripMap points={points} flights={flights} labels={labels} />
      {pendingLabel && <p className="text-xs text-muted-foreground">{pendingLabel}</p>}
    </div>
  );
}
