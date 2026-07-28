"use client";

import { MapContainer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L, { divIcon, type LatLngExpression, type LatLngTuple } from "leaflet";
import "@maplibre/maplibre-gl-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Fragment, useEffect, useMemo } from "react";
import type { FlightSegment, MapLabels, MapPoint } from "./TripMapView";
import "leaflet/dist/leaflet.css";
import "maplibre-gl/dist/maplibre-gl.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

// Vector tiles de OpenFreeMap (gratis, sin API key, sin límite de uso), en
// ambos casos con esquema OpenMapTiles estándar. "positron" ya compone
// name:latin + name:nonlatin en las etiquetas, y "dark-matter" (vendorizado en
// public/map-styles/, desde openmaptiles/dark-matter-gl-style, BSD-3, ver
// dark-matter-LICENSE.md ahí mismo) usa la sintaxis legacy
// {name:latin}\n{name:nonlatin} — ambos garantizan que ciudades en alfabetos
// no latinos (p.ej. Japón) muestren también su transcripción latina.
// El estilo se sirve como URL (no como objeto inline): pasar un style object
// directo a maplibre-gl deja el mapa colgado sin errores en este bundle.
const LIGHT_STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
const DARK_STYLE_URL = "/map-styles/dark-matter.json";

// El source de OpenFreeMap ya trae su propia atribución en el TileJSON, y
// @maplibre/maplibre-gl-leaflet la sincroniza sola con el attributionControl
// de Leaflet al terminar de cargar el estilo — solo hace falta añadir el
// crédito extra de Dark Matter a mano, sin duplicar lo que el bridge ya pone.
const DARK_EXTRA_ATTRIBUTION =
  'Style derived from <a href="https://github.com/openmaptiles/dark-matter-gl-style">Dark Matter</a> by CartoDB/MapTiler';

function VectorTileLayer() {
  const map = useMap();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  useEffect(() => {
    const layer = L.maplibreGL({ style: isDark ? DARK_STYLE_URL : LIGHT_STYLE_URL }).addTo(map);
    // MapLibre puede quedarse sin pintar el primer frame tras el montaje
    // inicial (su "load" nunca llega solo); forzar un resize de Leaflet en el
    // siguiente frame despierta el render loop sin depender de que el usuario
    // interactúe con la página.
    const kick = requestAnimationFrame(() => map.invalidateSize());
    if (isDark) map.attributionControl.addAttribution(DARK_EXTRA_ATTRIBUTION);
    return () => {
      cancelAnimationFrame(kick);
      layer.remove();
      if (isDark) map.attributionControl.removeAttribution(DARK_EXTRA_ATTRIBUTION);
    };
  }, [map, isDark]);

  return null;
}

// Pines SVG inline (sin depender de un CDN externo), color + glifo Lucide
// distintos por tipo (mismos iconos que trip-nav.tsx: Hotel y Star), para
// poder distinguir alojamiento vs actividad de un vistazo en el mapa.
const MARKER_COLORS: Record<MapPoint["kind"], string> = {
  accommodation: "#2563eb",
  activity: "#f97316",
};

// Path data de lucide-react v1.27.0 (icons/hotel.mjs, icons/star.mjs)
const MARKER_GLYPHS: Record<MapPoint["kind"], string> = {
  accommodation: `<path d="M10 22v-6.57"/><path d="M12 11h.01"/><path d="M12 7h.01"/><path d="M14 15.43V22"/><path d="M15 16a5 5 0 0 0-6 0"/><path d="M16 11h.01"/><path d="M16 7h.01"/><path d="M8 11h.01"/><path d="M8 7h.01"/><rect x="4" y="2" width="16" height="20" rx="2"/>`,
  activity: `<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>`,
};

function buildMarkerIcon(kind: MapPoint["kind"]) {
  const color = MARKER_COLORS[kind];
  const glyph = MARKER_GLYPHS[kind];
  return divIcon({
    className: "",
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 30 40">
      <path d="M15 0C6.7 0 0 6.7 0 15c0 11.3 15 25 15 25s15-13.7 15-25C30 6.7 23.3 0 15 0z" fill="${color}" stroke="white" stroke-width="1.5"/>
      <g transform="translate(6.6, 6.6) scale(0.7)" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        ${glyph}
      </g>
    </svg>`,
    iconSize: [30, 40],
    iconAnchor: [15, 40],
    popupAnchor: [0, -36],
  });
}

const markerIcons: Record<MapPoint["kind"], ReturnType<typeof divIcon>> = {
  accommodation: buildMarkerIcon("accommodation"),
  activity: buildMarkerIcon("activity"),
};

// Círculo neutro (gris oscuro, mismo idioma visual que los pines) en vez del
// verde/naranja/rojo por defecto de leaflet.markercluster, que desentonaba
// con la paleta de la app.
function createClusterIcon(cluster: { getChildCount: () => number }) {
  const count = cluster.getChildCount();
  const size = count < 10 ? 34 : count < 100 ? 40 : 46;
  return divIcon({
    className: "",
    html: `<div style="
      width: ${size}px; height: ${size}px; border-radius: 9999px;
      background: #404040; border: 2px solid white;
      display: flex; align-items: center; justify-content: center;
      font: 600 13px system-ui, sans-serif; color: white;
    ">${count}</div>`,
    iconSize: [size, size],
  });
}

const FLIGHT_COLOR = "#7c3aed";

// Path data de lucide-react v1.27.0 (icons/plane.mjs). El glifo apunta de
// fábrica hacia el NE (~45°), así que hay que restar ese offset al bearing
// real para que la rotación CSS lo alinee con la dirección del vuelo.
const PLANE_GLYPH = `<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>`;
const PLANE_GLYPH_HEADING_OFFSET = 45;

function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaLambda = toRad(lng2 - lng1);
  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function buildPlaneIcon(bearing: number) {
  const rotation = bearing - PLANE_GLYPH_HEADING_OFFSET;
  return divIcon({
    className: "",
    html: `<div style="transform: rotate(${rotation}deg); width: 26px; height: 26px;">
      <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="11" fill="${FLIGHT_COLOR}" stroke="white" stroke-width="1.5"/>
        <g transform="translate(5, 5) scale(0.58)" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          ${PLANE_GLYPH}
        </g>
      </svg>
    </div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -13],
  });
}

export function TripMap({
  points,
  flights,
  labels,
}: {
  points: readonly MapPoint[];
  flights: readonly FlightSegment[];
  labels: MapLabels;
}) {
  const bounds = useMemo<LatLngTuple[] | null>(() => {
    const coords: LatLngTuple[] = [
      ...points.map((p) => [p.lat, p.lng] as LatLngTuple),
      ...flights.flatMap((f) => [
        [f.originLat, f.originLng] as LatLngTuple,
        [f.destinationLat, f.destinationLng] as LatLngTuple,
      ]),
    ];
    return coords.length > 0 ? coords : null;
  }, [points, flights]);

  const routeCoords = useMemo<LatLngExpression[]>(() => {
    return points
      .filter((p) => p.date !== null)
      .slice()
      .sort((a, b) => (a.date! < b.date! ? -1 : a.date! > b.date! ? 1 : 0))
      .map((p) => [p.lat, p.lng] as LatLngExpression);
  }, [points]);

  const center = useMemo<LatLngExpression>(() => {
    const [first] = points;
    if (first) return [first.lat, first.lng];
    const [firstFlight] = flights;
    return firstFlight ? [firstFlight.originLat, firstFlight.originLng] : [40.4168, -3.7038];
  }, [points, flights]);

  return (
    <MapContainer
      center={center}
      bounds={bounds ?? undefined}
      boundsOptions={{ padding: [40, 40], maxZoom: 15 }}
      zoom={6}
      minZoom={2}
      maxZoom={18}
      zoomSnap={0.5}
      scrollWheelZoom
      className="h-[70vh] w-full rounded-lg z-0"
    >
      <VectorTileLayer />

      {routeCoords.length >= 2 && (
        <Polyline positions={routeCoords} pathOptions={{ color: "#2563eb", weight: 3, opacity: 0.7 }} />
      )}

      {flights.map((f) => {
        const origin: LatLngExpression = [f.originLat, f.originLng];
        const destination: LatLngExpression = [f.destinationLat, f.destinationLng];
        const midpoint: LatLngExpression = [(f.originLat + f.destinationLat) / 2, (f.originLng + f.destinationLng) / 2];
        const heading = bearingDeg(f.originLat, f.originLng, f.destinationLat, f.destinationLng);
        return (
          <Fragment key={f.id}>
            <Polyline
              positions={[origin, destination]}
              pathOptions={{ color: FLIGHT_COLOR, weight: 2.5, opacity: 0.85, dashArray: "6 6" }}
            />
            <Marker position={midpoint} icon={buildPlaneIcon(heading)}>
              <Popup>
                <div className="space-y-1">
                  <p className="font-semibold text-sm">{f.label || labels.flight}</p>
                  <p className="text-xs text-neutral-500">
                    {f.originName} → {f.destinationName}
                  </p>
                  {f.dateLabel && <p className="text-xs text-neutral-500">{f.dateLabel}</p>}
                  <Link href={f.detailHref} className="text-xs text-blue-600 underline">
                    {labels.viewDetail}
                  </Link>
                </div>
              </Popup>
            </Marker>
          </Fragment>
        );
      })}

      <MarkerClusterGroup
        chunkedLoading
        showCoverageOnHover={false}
        maxClusterRadius={50}
        iconCreateFunction={createClusterIcon}
      >
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
      </MarkerClusterGroup>
    </MapContainer>
  );
}
