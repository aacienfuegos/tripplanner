"use client";

import L, { divIcon } from "leaflet";
import "@maplibre/maplibre-gl-leaflet";
import { useTheme } from "next-themes";
import { useEffect } from "react";
import { useMap } from "react-leaflet";

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

export function VectorTileLayer() {
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

// Círculo neutro (gris oscuro, mismo idioma visual que los pines) en vez del
// verde/naranja/rojo por defecto de leaflet.markercluster, que desentonaba
// con la paleta de la app.
export function createClusterIcon(cluster: { getChildCount: () => number }) {
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

// Path SVG genérico de pin (mismo contorno que los marcadores del mapa de
// viaje) — recibe el color y el glifo interior para poder reutilizarse con
// distintos íconos sin duplicar el contorno.
export function buildPinIcon(color: string, glyphPath: string) {
  return divIcon({
    className: "",
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 30 40">
      <path d="M15 0C6.7 0 0 6.7 0 15c0 11.3 15 25 15 25s15-13.7 15-25C30 6.7 23.3 0 15 0z" fill="${color}" stroke="white" stroke-width="1.5"/>
      <g transform="translate(6.6, 6.6) scale(0.7)" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        ${glyphPath}
      </g>
    </svg>`,
    iconSize: [30, 40],
    iconAnchor: [15, 40],
    popupAnchor: [0, -36],
  });
}
