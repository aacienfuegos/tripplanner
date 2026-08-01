import { Modal, View, Text, TouchableOpacity } from "react-native";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import { DiveSite } from "@/db/dive-sites";
import { useT } from "@/contexts/I18nContext";

interface Props {
  visible: boolean;
  onClose: () => void;
  sites: DiveSite[];
}

// Mismo proveedor de tiles gratuito que la web (tiles.openfreemap.org, sin
// API key) — se carga vía WebView con Leaflet + MapLibre GL desde CDN,
// compatible con Expo Go (react-native-webview no requiere dev client).
function buildMapHtml(points: { id: number; name: string; subtitle: string | null; lat: number; lng: number }[]): string {
  const pointsJson = JSON.stringify(points);
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js"></script>
  <script src="https://unpkg.com/@maplibre/maplibre-gl-leaflet@0.0.20/leaflet-maplibre-gl.js"></script>
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; }
    .leaflet-popup-content { font-family: -apple-system, Roboto, sans-serif; font-size: 13px; }
    .leaflet-popup-content b { display: block; margin-bottom: 2px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const points = ${pointsJson};
    const map = L.map('map', { zoomControl: true });
    L.maplibreGL({ style: 'https://tiles.openfreemap.org/styles/positron' }).addTo(map);

    if (points.length > 0) {
      const markers = points.map((p) => {
        const m = L.marker([p.lat, p.lng]).addTo(map);
        const subtitle = p.subtitle ? '<br/>' + p.subtitle : '';
        m.bindPopup('<b>' + p.name + '</b>' + subtitle);
        return m;
      });
      const group = L.featureGroup(markers);
      map.fitBounds(group.getBounds().pad(0.2), { maxZoom: 12 });
    } else {
      map.setView([20, 0], 2);
    }
  </script>
</body>
</html>`;
}

export default function DiveSitesMapModal({ visible, onClose, sites }: Props) {
  const { t } = useT();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const points = sites
    .filter((s): s is DiveSite & { latitude: number; longitude: number } => s.latitude != null && s.longitude != null)
    .map((s) => ({
      id: s.id,
      name: s.name,
      subtitle: [s.region, s.country].filter(Boolean).join(", ") || null,
      lat: s.latitude,
      lng: s.longitude,
    }));

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
            source={{ html: buildMapHtml(points) }}
            javaScriptEnabled
            domStorageEnabled
          />
        )}
      </View>
    </Modal>
  );
}
