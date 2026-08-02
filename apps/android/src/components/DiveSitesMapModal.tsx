import { Modal, View, Text, TouchableOpacity } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import { DiveSite } from "@/db/dive-sites";
import { listDiveLogsForSite } from "@/db/dive-logs";
import { useT } from "@/contexts/I18nContext";

interface Props {
  visible: boolean;
  onClose: () => void;
  sites: DiveSite[];
  onViewSite: (siteId: number) => void;
}

// Mismo color/glifo que el pin "dive" del mapa de la web
// (apps/web/src/components/dives/DiveSitesMap.tsx, icons/waves.mjs de lucide).
const SITE_COLOR = "#06b6d4";
const SITE_GLYPH = `<path d="M2 12q2.5 2 5 0t5 0 5 0 5 0"/><path d="M2 19q2.5 2 5 0t5 0 5 0 5 0"/><path d="M2 5q2.5 2 5 0t5 0 5 0 5 0"/>`;

interface MapPoint {
  id: number;
  name: string;
  subtitle: string | null;
  diveCountLabel: string;
  lat: number;
  lng: number;
}

// Mismo proveedor de tiles gratuito que la web (tiles.openfreemap.org, sin
// API key) — se carga vía WebView con Leaflet + MapLibre GL + markercluster
// desde CDN, compatible con Expo Go (react-native-webview no requiere dev
// client). El popup manda un postMessage a RN para navegar al detalle,
// ya que el WebView no puede usar expo-router directamente.
function buildMapHtml(points: MapPoint[], viewDetailLabel: string): string {
  const pointsJson = JSON.stringify(points);
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
    .site-popup p { margin: 2px 0; color: #737373; }
    .site-popup a { color: #2563eb; text-decoration: underline; font-size: 12px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
  try {
    const points = ${pointsJson};
    const siteIcon = L.divIcon({
      className: '',
      html: '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 30 40">' +
        '<path d="M15 0C6.7 0 0 6.7 0 15c0 11.3 15 25 15 25s15-13.7 15-25C30 6.7 23.3 0 15 0z" fill="${SITE_COLOR}" stroke="white" stroke-width="1.5"/>' +
        '<g transform="translate(6.6, 6.6) scale(0.7)" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${SITE_GLYPH}</g>' +
        '</svg>',
      iconSize: [30, 40], iconAnchor: [15, 40], popupAnchor: [0, -36],
    });

    const map = L.map('map', { zoomControl: true, minZoom: 2, maxZoom: 18 });
    L.maplibreGL({ style: 'https://tiles.openfreemap.org/styles/positron' }).addTo(map);

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
        const marker = L.marker([p.lat, p.lng], { icon: siteIcon });
        const subtitle = p.subtitle ? '<p>' + p.subtitle + '</p>' : '';
        marker.bindPopup(
          '<div class="site-popup"><b>' + p.name + '</b>' + subtitle +
          '<p>' + p.diveCountLabel + '</p>' +
          '<a href="#" onclick="window.ReactNativeWebView.postMessage(JSON.stringify({siteId:' + p.id + '})); return false;">' + ${JSON.stringify(viewDetailLabel)} + '</a></div>'
        );
        cluster.addLayer(marker);
      });
      map.addLayer(cluster);

      const group = L.featureGroup(points.map((p) => L.marker([p.lat, p.lng])));
      map.fitBounds(group.getBounds().pad(0.2), { maxZoom: 12 });
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

export default function DiveSitesMapModal({ visible, onClose, sites, onViewSite }: Props) {
  const { t } = useT();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const points: MapPoint[] = sites
    .filter((s): s is DiveSite & { latitude: number; longitude: number } => s.latitude != null && s.longitude != null)
    .map((s) => ({
      id: s.id,
      name: s.name,
      subtitle: [s.region, s.country].filter(Boolean).join(", ") || null,
      diveCountLabel: t.diveSiteMapDiveCount(listDiveLogsForSite(s.id).length),
      lat: s.latitude,
      lng: s.longitude,
    }));

  function handleMessage(event: WebViewMessageEvent) {
    try {
      const data = JSON.parse(event.nativeEvent.data) as { siteId?: number };
      if (data.siteId != null) {
        onClose();
        onViewSite(data.siteId);
      }
    } catch {
      // Mensaje inesperado del WebView — se ignora, no es crítico.
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-white dark:bg-zinc-950">
        <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-zinc-800">
          <Text className="text-lg font-semibold text-gray-900 dark:text-white">{t.viewDiveSitesMap}</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={isDark ? "#a1a1aa" : "#6b7280"} />
          </TouchableOpacity>
        </View>
        {points.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-sm text-slate-400 dark:text-slate-500 text-center">{t.noDiveSites}</Text>
          </View>
        ) : (
          <WebView
            originWhitelist={["*"]}
            source={{ html: buildMapHtml(points, t.viewDetail) }}
            javaScriptEnabled
            domStorageEnabled
            onMessage={handleMessage}
          />
        )}
      </View>
    </Modal>
  );
}
