"use client";

import { MapContainer, Marker, Popup } from "react-leaflet";
import { type LatLngTuple } from "leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import Link from "next/link";
import { useMemo } from "react";
import { VectorTileLayer, createClusterIcon, buildPinIcon } from "@/components/map/map-utils";
import type { DiveSitePoint, DiveSitesMapLabels } from "./DiveSitesMapView";
import "leaflet/dist/leaflet.css";
import "maplibre-gl/dist/maplibre-gl.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

// Mismo color/glifo que el pin "dive" del mapa de viaje (icons/waves.mjs).
const SITE_COLOR = "#06b6d4";
const SITE_GLYPH = `<path d="M2 12q2.5 2 5 0t5 0 5 0 5 0"/><path d="M2 19q2.5 2 5 0t5 0 5 0 5 0"/><path d="M2 5q2.5 2 5 0t5 0 5 0 5 0"/>`;
const siteIcon = buildPinIcon(SITE_COLOR, SITE_GLYPH);

export function DiveSitesMap({
  points,
  labels,
}: {
  points: readonly DiveSitePoint[];
  labels: DiveSitesMapLabels;
}) {
  const bounds = useMemo<LatLngTuple[] | null>(() => {
    const coords = points.map((p) => [p.lat, p.lng] as LatLngTuple);
    return coords.length > 0 ? coords : null;
  }, [points]);

  const center = useMemo<LatLngTuple>(() => {
    const [first] = points;
    return first ? [first.lat, first.lng] : [40.4168, -3.7038];
  }, [points]);

  return (
    <MapContainer
      center={center}
      bounds={bounds ?? undefined}
      boundsOptions={{ padding: [40, 40], maxZoom: 15 }}
      zoom={4}
      minZoom={2}
      maxZoom={18}
      zoomSnap={0.5}
      scrollWheelZoom
      className="h-[60vh] w-full rounded-lg z-0"
    >
      <VectorTileLayer />
      <MarkerClusterGroup
        chunkedLoading
        showCoverageOnHover={false}
        maxClusterRadius={50}
        iconCreateFunction={createClusterIcon}
      >
        {points.map((p) => (
          <Marker key={p.id} position={[p.lat, p.lng]} icon={siteIcon}>
            <Popup>
              <div className="space-y-1">
                <p className="font-semibold text-sm">{p.name}</p>
                {p.subtitle && <p className="text-xs text-neutral-500">{p.subtitle}</p>}
                <p className="text-xs text-neutral-500">{p.diveCountLabel}</p>
                <Link href={p.detailHref} className="text-xs text-blue-600 underline">
                  {labels.viewDetail}
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MarkerClusterGroup>
    </MapContainer>
  );
}
