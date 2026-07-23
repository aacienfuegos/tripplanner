"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

export type MapPoint = {
  readonly id: string;
  readonly kind: "accommodation" | "activity";
  readonly name: string;
  readonly lat: number;
  readonly lng: number;
  readonly subtitle: string | null;
  readonly date: string | null;
  readonly dateLabel: string | null;
  readonly detailHref: string;
};

// Leaflet toca window/document en import: se carga solo en cliente (ssr: false),
// lo que sólo es válido dentro de un Client Component en Next.js 16.
const TripMap = dynamic(() => import("./TripMap").then((m) => m.TripMap), {
  ssr: false,
  loading: () => <Skeleton className="h-[70vh] w-full rounded-lg" />,
});

export function TripMapView({ points, pendingCount }: { points: readonly MapPoint[]; pendingCount: number }) {
  return (
    <div className="space-y-2">
      <TripMap points={points} />
      {pendingCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {pendingCount} elemento{pendingCount === 1 ? "" : "s"} sin ubicar todavía. La geolocalización se
          completa de forma progresiva; vuelve a abrir el mapa en unos segundos.
        </p>
      )}
    </div>
  );
}
