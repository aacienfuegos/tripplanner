"use client";

import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import { divIcon, type LatLngExpression, type LatLngTuple } from "leaflet";
import Link from "next/link";
import { useMemo } from "react";
import type { MapLabels, MapPoint } from "./TripMapView";
import "leaflet/dist/leaflet.css";

// Pines SVG inline (sin depender de un CDN externo) con color distinto por tipo,
// para poder distinguir alojamiento vs actividad de un vistazo en el mapa.
const MARKER_COLORS: Record<MapPoint["kind"], string> = {
  accommodation: "#2563eb",
  activity: "#f97316",
};

function buildMarkerIcon(kind: MapPoint["kind"]) {
  const color = MARKER_COLORS[kind];
  return divIcon({
    className: "",
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="25" height="34" viewBox="0 0 25 34">
      <path d="M12.5 0C5.6 0 0 5.6 0 12.5c0 9.4 12.5 21.5 12.5 21.5S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0z" fill="${color}" stroke="white" stroke-width="1.5"/>
      <circle cx="12.5" cy="12.5" r="5" fill="white"/>
    </svg>`,
    iconSize: [25, 34],
    iconAnchor: [12.5, 34],
    popupAnchor: [0, -30],
  });
}

const markerIcons: Record<MapPoint["kind"], ReturnType<typeof divIcon>> = {
  accommodation: buildMarkerIcon("accommodation"),
  activity: buildMarkerIcon("activity"),
};

export function TripMap({ points, labels }: { points: readonly MapPoint[]; labels: MapLabels }) {
  const bounds = useMemo<LatLngTuple[] | null>(() => {
    if (points.length === 0) return null;
    return points.map((p) => [p.lat, p.lng] as LatLngTuple);
  }, [points]);

  const routeCoords = useMemo<LatLngExpression[]>(() => {
    return points
      .filter((p) => p.date !== null)
      .slice()
      .sort((a, b) => (a.date! < b.date! ? -1 : a.date! > b.date! ? 1 : 0))
      .map((p) => [p.lat, p.lng] as LatLngExpression);
  }, [points]);

  const center = useMemo<LatLngExpression>(() => {
    const [first] = points;
    return first ? [first.lat, first.lng] : [40.4168, -3.7038];
  }, [points]);

  return (
    <MapContainer
      center={center}
      bounds={bounds ?? undefined}
      zoom={6}
      scrollWheelZoom
      className="h-[70vh] w-full rounded-lg z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {routeCoords.length >= 2 && (
        <Polyline positions={routeCoords} pathOptions={{ color: "#2563eb", weight: 3, opacity: 0.7 }} />
      )}

      {points.map((p) => (
        <Marker key={`${p.kind}-${p.id}`} position={[p.lat, p.lng]} icon={markerIcons[p.kind]}>
          <Popup>
            <div className="space-y-1">
              <p className="font-semibold text-sm">{p.name}</p>
              <p className="text-xs text-neutral-500">
                {p.kind === "accommodation" ? labels.accommodation : labels.activity}
                {p.subtitle ? ` · ${p.subtitle}` : ""}
              </p>
              {p.dateLabel && <p className="text-xs text-neutral-500">{p.dateLabel}</p>}
              <Link href={p.detailHref} className="text-xs text-blue-600 underline">
                {labels.viewDetail}
              </Link>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
