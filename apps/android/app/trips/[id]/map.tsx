import { useState, useCallback } from "react";
import { View, Text } from "react-native";
import { Tabs, useFocusEffect, useGlobalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { listAccommodations } from "@/db/accommodations";
import { listActivities } from "@/db/activities";
import { listFlights } from "@/db/flights";
import { listDiveLogsForTrip } from "@/db/dive-logs";
import { getDiveSite } from "@/db/dive-sites";
import { useT } from "@/contexts/I18nContext";

// Mismos colores/glifos que el mapa de viaje de la web
// (apps/web/src/components/map/TripMap.tsx, icons de lucide-react v1.27.0).
const MARKER_COLORS = { accommodation: "#2563eb", activity: "#f97316", dive: "#06b6d4" } as const;
const MARKER_GLYPHS = {
  accommodation: `<path d="M10 22v-6.57"/><path d="M12 11h.01"/><path d="M12 7h.01"/><path d="M14 15.43V22"/><path d="M15 16a5 5 0 0 0-6 0"/><path d="M16 11h.01"/><path d="M16 7h.01"/><path d="M8 11h.01"/><path d="M8 7h.01"/><rect x="4" y="2" width="16" height="20" rx="2"/>`,
  activity: `<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>`,
  dive: `<path d="M2 12q2.5 2 5 0t5 0 5 0 5 0"/><path d="M2 19q2.5 2 5 0t5 0 5 0 5 0"/><path d="M2 5q2.5 2 5 0t5 0 5 0 5 0"/>`,
} as const;
const FLIGHT_COLOR = "#7c3aed";
const PLANE_GLYPH = `<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>`;
const PLANE_HEADING_OFFSET = 45;

type PointKind = "accommodation" | "activity" | "dive";

interface MapPoint {
  id: string;
  kind: PointKind;
  name: string;
  subtitle: string | null;
  date: string | null;
  dateLabel: string | null;
  lat: number;
  lng: number;
  navTarget: "accommodations" | "activities" | "dives";
  siteId?: number;
}

interface FlightSegment {
  id: string;
  originName: string;
  destinationName: string;
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
  label: string;
  dateLabel: string | null;
  departureAt: string | null;
  arrivalAt: string | null;
  rotation: number;
}

// El glifo del avión (lucide plane.mjs) apunta de fábrica hacia el NE (~45°),
// así que hay que restar ese offset al bearing real para alinear la rotación.
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

// Un tramo de tierra por cada par de puntos consecutivos en el tiempo, salvo
// que un vuelo haya salido entre medias (ese tramo ya lo cubren la línea del
// vuelo y los conectores a los aeropuertos).
function buildGroundSegments(points: MapPoint[], flights: FlightSegment[]): [number, number][][] {
  const sorted = points
    .filter((p): p is MapPoint & { date: string } => p.date !== null)
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const segments: [number, number][][] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    const flightBetween = flights.some((f) => f.departureAt && f.departureAt > a.date && f.departureAt < b.date);
    if (!flightBetween) segments.push([[a.lat, a.lng], [b.lat, b.lng]]);
  }
  return segments;
}

// Tramo de tierra entre el último punto antes de un vuelo y su aeropuerto de
// salida, y entre el aeropuerto de llegada y el siguiente punto — sin esto el
// vuelo queda "flotando" sin conexión visible con el resto del itinerario.
function buildAirportConnectors(points: MapPoint[], flights: FlightSegment[]): [number, number][][] {
  const dated = points
    .filter((p): p is MapPoint & { date: string } => p.date !== null)
    .map((p) => ({ date: p.date, position: [p.lat, p.lng] as [number, number] }));

  const connectors: [number, number][][] = [];
  for (const f of flights) {
    if (f.departureAt) {
      const before = dated
        .filter((p) => p.date <= f.departureAt!)
        .sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0))[0];
      if (before) connectors.push([before.position, [f.originLat, f.originLng]]);
    }
    if (f.arrivalAt) {
      const after = dated
        .filter((p) => p.date >= f.arrivalAt!)
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))[0];
      if (after) connectors.push([[f.destinationLat, f.destinationLng], after.position]);
    }
  }
  return connectors;
}

function buildMapHtml(
  points: MapPoint[],
  flights: FlightSegment[],
  groundSegments: [number, number][][],
  airportConnectors: [number, number][][],
  labels: { accommodation: string; activity: string; dive: string; flight: string; viewDetail: string }
): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
  <script src="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js"></script>
  <script src="https://unpkg.com/@maplibre/maplibre-gl-leaflet@0.0.20/leaflet-maplibre-gl.js"></script>
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; }
    .leaflet-popup-content { font-family: -apple-system, Roboto, sans-serif; font-size: 13px; }
    .leaflet-popup-content b { display: block; margin-bottom: 2px; }
    .trip-map-popup p { margin: 2px 0; color: #737373; }
    .trip-map-popup a { color: #2563eb; text-decoration: underline; font-size: 12px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
  try {
    const points = ${JSON.stringify(points)};
    const flights = ${JSON.stringify(flights)};
    const groundSegments = ${JSON.stringify(groundSegments)};
    const airportConnectors = ${JSON.stringify(airportConnectors)};
    const labels = ${JSON.stringify(labels)};

    const markerColors = ${JSON.stringify(MARKER_COLORS)};
    const markerGlyphs = ${JSON.stringify(MARKER_GLYPHS)};

    function buildPinIcon(color, glyph) {
      return L.divIcon({
        className: '',
        html: '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 30 40">' +
          '<path d="M15 0C6.7 0 0 6.7 0 15c0 11.3 15 25 15 25s15-13.7 15-25C30 6.7 23.3 0 15 0z" fill="' + color + '" stroke="white" stroke-width="1.5"/>' +
          '<g transform="translate(6.6, 6.6) scale(0.7)" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + glyph + '</g>' +
          '</svg>',
        iconSize: [30, 40], iconAnchor: [15, 40], popupAnchor: [0, -36],
      });
    }
    const markerIcons = {
      accommodation: buildPinIcon(markerColors.accommodation, markerGlyphs.accommodation),
      activity: buildPinIcon(markerColors.activity, markerGlyphs.activity),
      dive: buildPinIcon(markerColors.dive, markerGlyphs.dive),
    };

    function buildPlaneIcon(rotation) {
      return L.divIcon({
        className: '',
        html: '<div style="transform: rotate(' + rotation + 'deg); width: 26px; height: 26px;">' +
          '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24">' +
          '<circle cx="12" cy="12" r="11" fill="${FLIGHT_COLOR}" stroke="white" stroke-width="1.5"/>' +
          '<g transform="translate(5, 5) scale(0.58)" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${PLANE_GLYPH}</g>' +
          '</svg></div>',
        iconSize: [26, 26], iconAnchor: [13, 13], popupAnchor: [0, -13],
      });
    }

    const map = L.map('map', { zoomControl: true, minZoom: 2, maxZoom: 18 });
    L.maplibreGL({ style: 'https://tiles.openfreemap.org/styles/positron' }).addTo(map);

    groundSegments.forEach((positions) => {
      L.polyline(positions, { color: '#2563eb', weight: 3, opacity: 0.7 }).addTo(map);
    });
    airportConnectors.forEach((positions) => {
      L.polyline(positions, { color: '#2563eb', weight: 3, opacity: 0.7 }).addTo(map);
    });

    flights.forEach((f) => {
      L.polyline([[f.originLat, f.originLng], [f.destinationLat, f.destinationLng]], {
        color: '${FLIGHT_COLOR}', weight: 2.5, opacity: 0.85, dashArray: '6 6',
      }).addTo(map);
      const midpoint = [(f.originLat + f.destinationLat) / 2, (f.originLng + f.destinationLng) / 2];
      const marker = L.marker(midpoint, { icon: buildPlaneIcon(f.rotation) });
      const dateLine = f.dateLabel ? '<p>' + f.dateLabel + '</p>' : '';
      marker.bindPopup(
        '<div class="trip-map-popup"><b>' + (f.label || labels.flight) + '</b>' +
        '<p>' + f.originName + ' → ' + f.destinationName + '</p>' + dateLine +
        '<a href="#" onclick="window.ReactNativeWebView.postMessage(JSON.stringify({target:\\'flights\\'})); return false;">' + labels.viewDetail + '</a></div>'
      );
      marker.addTo(map);
    });

    const allCoords = points.map((p) => [p.lat, p.lng])
      .concat(flights.flatMap((f) => [[f.originLat, f.originLng], [f.destinationLat, f.destinationLng]]));

    if (points.length > 0) {
      const cluster = L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 50,
        iconCreateFunction: function (c) {
          const count = c.getChildCount();
          const size = count < 10 ? 34 : count < 100 ? 40 : 46;
          return L.divIcon({
            className: '',
            html: '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:9999px;background:#404040;border:2px solid white;display:flex;align-items:center;justify-content:center;font:600 13px system-ui, sans-serif;color:white;">' + count + '</div>',
            iconSize: [size, size],
          });
        },
      });

      points.forEach((p) => {
        const marker = L.marker([p.lat, p.lng], { icon: markerIcons[p.kind] });
        const kindLabel = p.kind === 'accommodation' ? labels.accommodation : p.kind === 'activity' ? labels.activity : labels.dive;
        const subtitle = p.subtitle ? ' · ' + p.subtitle : '';
        const dateLine = p.dateLabel ? '<p>' + p.dateLabel + '</p>' : '';
        marker.bindPopup(
          '<div class="trip-map-popup"><b>' + p.name + '</b><p>' + kindLabel + subtitle + '</p>' + dateLine +
          '<a href="#" onclick="window.ReactNativeWebView.postMessage(JSON.stringify({target:\\'' + p.navTarget + '\\', siteId:' + (p.siteId ?? 'null') + '})); return false;">' + labels.viewDetail + '</a></div>'
        );
        cluster.addLayer(marker);
      });
      map.addLayer(cluster);
    }

    if (allCoords.length > 0) {
      const group = L.featureGroup(allCoords.map((c) => L.marker(c)));
      map.fitBounds(group.getBounds().pad(0.2), { maxZoom: 15 });
    } else {
      map.setView([20, 0], 2);
    }
  } catch (err) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ jsError: String(err && err.stack || err) }));
  }
  </script>
</body>
</html>`;
}

export default function TripMapScreen() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const tripId = Number(id);
  const router = useRouter();
  const { t, lang } = useT();

  const [points, setPoints] = useState<MapPoint[]>([]);
  const [flightSegments, setFlightSegments] = useState<FlightSegment[]>([]);
  const [pendingCount, setPendingCount] = useState(0);

  const refresh = useCallback(async () => {
    const [accommodations, activities, flights] = await Promise.all([
      listAccommodations(tripId), listActivities(tripId), listFlights(tripId),
    ]);
    const dives = listDiveLogsForTrip(tripId);
    const locale = lang === "es" ? "es-ES" : "en-US";

    const newPoints: MapPoint[] = [];
    let missing = 0;

    for (const a of accommodations) {
      if (a.latitude == null || a.longitude == null) { missing++; continue; }
      newPoints.push({
        id: `accommodation-${a.id}`, kind: "accommodation", name: a.name, subtitle: a.city,
        date: a.check_in,
        dateLabel: a.check_in
          ? `${t.checkIn} ${new Date(a.check_in + "T12:00:00").toLocaleDateString(locale, { day: "numeric", month: "short" })}`
          : null,
        lat: a.latitude, lng: a.longitude, navTarget: "accommodations",
      });
    }

    for (const a of activities) {
      if (a.latitude == null || a.longitude == null) { if (a.location || a.city) missing++; continue; }
      newPoints.push({
        id: `activity-${a.id}`, kind: "activity", name: a.name, subtitle: a.location ?? a.city,
        date: a.scheduled_at,
        dateLabel: a.scheduled_at
          ? new Date(a.scheduled_at).toLocaleDateString(locale, { day: "numeric", month: "short" }) +
            "  " + new Date(a.scheduled_at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
          : null,
        lat: a.latitude, lng: a.longitude, navTarget: "activities",
      });
    }

    for (const d of dives) {
      if (!d.dive_site_id) continue;
      const site = getDiveSite(d.dive_site_id);
      if (!site || site.latitude == null || site.longitude == null) continue;
      newPoints.push({
        id: `dive-${d.id}`, kind: "dive", name: site.name,
        subtitle: [site.region, site.country].filter(Boolean).join(", ") || null,
        date: d.date,
        dateLabel: `#${d.dive_number} · ${new Date(d.date).toLocaleDateString(locale, { day: "numeric", month: "short" })}`,
        lat: site.latitude, lng: site.longitude, navTarget: "dives", siteId: site.id,
      });
    }

    const newFlights: FlightSegment[] = [];
    for (const f of flights) {
      if (f.origin_lat == null || f.origin_lng == null || f.destination_lat == null || f.destination_lng == null) {
        missing++;
        continue;
      }
      newFlights.push({
        id: `flight-${f.id}`, originName: f.origin, destinationName: f.destination,
        originLat: f.origin_lat, originLng: f.origin_lng,
        destinationLat: f.destination_lat, destinationLng: f.destination_lng,
        label: [f.airline, f.flight_number].filter(Boolean).join(" "),
        dateLabel: f.departure_at
          ? new Date(f.departure_at).toLocaleDateString(locale, { day: "numeric", month: "short" }) +
            "  " + new Date(f.departure_at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
          : null,
        departureAt: f.departure_at, arrivalAt: f.arrival_at,
        rotation: bearingDeg(f.origin_lat, f.origin_lng, f.destination_lat, f.destination_lng) - PLANE_HEADING_OFFSET,
      });
    }

    setPoints(newPoints);
    setFlightSegments(newFlights);
    setPendingCount(missing);
  }, [tripId, lang, t]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  function handleMessage(event: WebViewMessageEvent) {
    try {
      const data = JSON.parse(event.nativeEvent.data) as { target?: string; siteId?: number; jsError?: string };
      if (data.jsError) return;
      if (data.target === "dives" && data.siteId != null) {
        router.push(`/dives/site-detail?id=${data.siteId}`);
      } else if (data.target) {
        router.push(`/trips/${tripId}/${data.target}`);
      }
    } catch {
      // Mensaje inesperado del WebView — se ignora, no es crítico.
    }
  }

  const groundSegments = buildGroundSegments(points, flightSegments);
  const airportConnectors = buildAirportConnectors(points, flightSegments);

  return (
    <SafeAreaView className="flex-1 bg-zinc-50 dark:bg-zinc-950" edges={["bottom"]}>
      <Tabs.Screen options={{ title: t.sectionMap }} />

      {points.length === 0 && flightSegments.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="map-outline" size={40} color="#cbd5e1" />
          <Text className="mt-3 text-base font-semibold text-slate-700 dark:text-slate-200 text-center">
            {t.noGeolocatedItems}
          </Text>
          <Text className="mt-1 text-xs text-slate-400 dark:text-slate-500 text-center">
            {t.noGeolocatedItemsHint}
          </Text>
        </View>
      ) : (
        <>
          <WebView
            originWhitelist={["*"]}
            source={{
              html: buildMapHtml(points, flightSegments, groundSegments, airportConnectors, {
                accommodation: t.accommodation, activity: t.activity, dive: t.dives,
                flight: t.flight, viewDetail: t.viewDetail,
              }),
            }}
            javaScriptEnabled
            domStorageEnabled
            onMessage={handleMessage}
          />
          {pendingCount > 0 && (
            <Text className="text-xs text-slate-400 dark:text-slate-500 text-center py-2 px-4">
              {t.pendingGeolocation(pendingCount)}
            </Text>
          )}
        </>
      )}
    </SafeAreaView>
  );
}
