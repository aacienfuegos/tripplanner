import { DiveLog, DiveProfileSample } from "@/db/dive-logs";

const DESCENT_RATE_M_PER_MIN = 18; // media recreativa (PADI recomienda máx. 18 m/min)
const ASCENT_RATE_M_PER_MIN = 9; // máx. recomendado por la mayoría de ordenadores
const SAFETY_STOP_DEPTH = 5;
const SAMPLE_INTERVAL_SECONDS = 15;

interface ProfilePoint {
  t: number;
  depth: number;
}

export interface SynthesizeProfileInput {
  depthMax: number;
  bottomTimeMinutes: number;
  safetyStopMinutes: number | null;
  waterTemp: number | null;
}

function interpolateDepth(points: ProfilePoint[], t: number): number {
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (t >= a.t && t <= b.t) {
      const ratio = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t);
      return Math.round((a.depth + (b.depth - a.depth) * ratio) * 10) / 10;
    }
  }
  return points[points.length - 1]?.depth ?? 0;
}

// Deriva una curva profundidad/tiempo plausible (descenso, fondo con ligera
// variación, ascenso y parada de seguridad) para buceos sin muestras reales
// de ordenador. No es una reconstrucción exacta — es una aproximación visual
// basada en velocidades estándar recreativas, para que todo buceo introducido
// a mano tenga gráfica aunque no venga de un import.
export function synthesizeProfile(input: SynthesizeProfileInput): DiveProfileSample[] {
  const { depthMax, bottomTimeMinutes, waterTemp } = input;
  if (depthMax <= 0 || bottomTimeMinutes <= 0) return [];

  const descentSeconds = Math.max(30, Math.round((depthMax / DESCENT_RATE_M_PER_MIN) * 60));
  const safetyStopMinutes = input.safetyStopMinutes ?? (depthMax >= 12 ? 3 : 0);
  const safetyStopSeconds = safetyStopMinutes * 60;
  const hasSafetyStop = depthMax > SAFETY_STOP_DEPTH;
  const ascentToStopSeconds = Math.round(
    ((hasSafetyStop ? depthMax - SAFETY_STOP_DEPTH : depthMax) / ASCENT_RATE_M_PER_MIN) * 60
  );
  const finalAscentSeconds = hasSafetyStop
    ? Math.round((SAFETY_STOP_DEPTH / ASCENT_RATE_M_PER_MIN) * 60)
    : 0;

  const totalBottomSeconds = bottomTimeMinutes * 60;
  const bottomSeconds = Math.max(
    30,
    totalBottomSeconds - descentSeconds - ascentToStopSeconds - safetyStopSeconds - finalAscentSeconds
  );

  const points: ProfilePoint[] = [{ t: 0, depth: 0 }];
  let t = descentSeconds;
  points.push({ t, depth: depthMax });

  const bottomStart = t;
  points.push({ t: bottomStart + bottomSeconds * 0.35, depth: depthMax * 0.94 });
  points.push({ t: bottomStart + bottomSeconds * 0.7, depth: depthMax * 0.97 });
  t = bottomStart + bottomSeconds;
  points.push({ t, depth: depthMax * 0.9 });

  t += ascentToStopSeconds;
  points.push({ t, depth: hasSafetyStop ? SAFETY_STOP_DEPTH : 0 });

  if (hasSafetyStop) {
    if (safetyStopSeconds > 0) {
      t += safetyStopSeconds;
      points.push({ t, depth: SAFETY_STOP_DEPTH });
    }
    t += finalAscentSeconds;
    points.push({ t, depth: 0 });
  }

  const totalSeconds = t;
  const samples: DiveProfileSample[] = [];
  for (let sec = 0; sec <= totalSeconds; sec += SAMPLE_INTERVAL_SECONDS) {
    samples.push({ seconds: sec, depth: interpolateDepth(points, sec), temp: waterTemp });
  }
  if (samples[samples.length - 1]?.seconds !== totalSeconds) {
    samples.push({ seconds: totalSeconds, depth: 0, temp: waterTemp });
  }
  return samples;
}

// Usa las muestras reales importadas si existen; si no, sintetiza una curva
// aproximada a partir de los datos resumen del buceo.
export function resolveDiveProfile(dive: DiveLog, storedSamples: DiveProfileSample[]): DiveProfileSample[] {
  if (storedSamples.length > 0) return storedSamples;
  return synthesizeProfile({
    depthMax: dive.depth_max,
    bottomTimeMinutes: dive.bottom_time,
    safetyStopMinutes: dive.safety_stop_minutes,
    waterTemp: dive.water_temp,
  });
}
