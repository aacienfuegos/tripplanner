"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

export type DiveSitePoint = {
  readonly id: string;
  readonly name: string;
  readonly lat: number;
  readonly lng: number;
  readonly subtitle: string | null;
  readonly diveCountLabel: string;
  readonly detailHref: string;
};

export type DiveSitesMapLabels = {
  readonly viewDetail: string;
};

// Leaflet toca window/document en import: se carga solo en cliente (ssr: false),
// lo que sólo es válido dentro de un Client Component en Next.js 16.
const DiveSitesMap = dynamic(() => import("./DiveSitesMap").then((m) => m.DiveSitesMap), {
  ssr: false,
  loading: () => <Skeleton className="h-[60vh] w-full rounded-lg" />,
});

export function DiveSitesMapView({
  points,
  labels,
}: {
  points: readonly DiveSitePoint[];
  labels: DiveSitesMapLabels;
}) {
  return <DiveSitesMap points={points} labels={labels} />;
}
