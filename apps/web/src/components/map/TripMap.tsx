"use client";

import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import { Icon, type LatLngExpression, type LatLngTuple } from "leaflet";
import Link from "next/link";
import { useMemo } from "react";
import type { MapPoint } from "./TripMapView";
import "leaflet/dist/leaflet.css";

// Leaflet resuelve los iconos por defecto con rutas relativas al CSS que el
// bundler rompe; se sirven desde /public para no depender de un CDN externo.
const markerIconInstance = new Icon({
  iconUrl: "/leaflet/marker-icon.png",
  iconRetinaUrl: "/leaflet/marker-icon-2x.png",
  shadowUrl: "/leaflet/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export function TripMap({ points }: { points: readonly MapPoint[] }) {
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
        <Marker key={`${p.kind}-${p.id}`} position={[p.lat, p.lng]} icon={markerIconInstance}>
          <Popup>
            <div className="space-y-1">
              <p className="font-semibold text-sm">{p.name}</p>
              <p className="text-xs text-neutral-500">
                {p.kind === "accommodation" ? "Alojamiento" : "Actividad"}
                {p.subtitle ? ` · ${p.subtitle}` : ""}
              </p>
              {p.dateLabel && <p className="text-xs text-neutral-500">{p.dateLabel}</p>}
              <Link href={p.detailHref} className="text-xs text-blue-600 underline">
                Ver detalle
              </Link>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
