"use client";

import type { ProfileSample } from "@/lib/dive-profile";
import { findSafetyStopRange } from "@/lib/dive-profile";
import { useT } from "@/contexts/LanguageContext";

const WIDTH = 640;
const HEIGHT = 260;
const PADDING = { top: 16, right: 16, bottom: 26, left: 34 };
const DEPTH_COLOR = "#0e7490";
const SAFETY_STOP_COLOR = "#f59e0b";
const TEMP_COLOR = "#dc2626";
const NDL_COLOR = "#16a34a";
const NDL_DISPLAY_CAP = 120;

function formatMinutes(seconds: number): string {
  return `${Math.round(seconds / 60)}min`;
}

interface AxisConfig {
  color: string;
  unit: string;
  invert: boolean;
  floor?: number;
  chartLabel: string;
  emptyLabel: string;
}

// Pill de fondo para que una etiqueta sea legible sin importar qué haya
// detrás (la línea de la curva, el área rellena, otra etiqueta). El ancho es
// una estimación por nº de caracteres — no hay medición real de texto en SVG
// sin tocar el DOM, pero sobra margen para que nunca quede corto.
function LabelPill({
  cx,
  cy,
  lines,
}: {
  cx: number;
  cy: number;
  lines: { text: string; fontSize: number; weight?: number; color?: string; opacity?: number }[];
}) {
  const widths = lines.map((l) => l.text.length * l.fontSize * 0.62);
  const width = Math.max(...widths) + 14;
  const lineHeight = Math.max(...lines.map((l) => l.fontSize)) + 5;
  const height = lines.length * lineHeight + 6;
  const top = cy - height;

  return (
    <g>
      <rect x={cx - width / 2} y={top} width={width} height={height} rx={5} fill="var(--card)" fillOpacity={0.92} />
      {lines.map((l, i) => (
        <text
          key={i}
          x={cx}
          y={top + lineHeight * (i + 1) - 4}
          textAnchor="middle"
          fontSize={l.fontSize}
          fontWeight={l.weight ?? 400}
          fill={l.color ?? "currentColor"}
          opacity={l.opacity ?? 1}
        >
          {l.text}
        </text>
      ))}
    </g>
  );
}

function LineChart({
  points,
  totalSeconds,
  axis,
  extra,
}: {
  points: { seconds: number; value: number }[];
  totalSeconds: number;
  axis: AxisConfig;
  extra?: React.ReactNode;
}) {
  if (points.length < 2) {
    return <p className="text-sm text-muted-foreground py-10 text-center">{axis.emptyLabel}</p>;
  }

  const values = points.map((p) => p.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const domainMin = axis.invert ? 0 : Math.max(axis.floor ?? -Infinity, Math.floor(rawMin - 1));
  const domainMax = axis.invert
    ? Math.max(5, Math.ceil(rawMax / 5) * 5)
    : Math.ceil(rawMax + 1);
  const span = domainMax - domainMin || 1;

  const chartWidth = WIDTH - PADDING.left - PADDING.right;
  const chartHeight = HEIGHT - PADDING.top - PADDING.bottom;

  const x = (seconds: number) =>
    PADDING.left + (totalSeconds === 0 ? 0 : (seconds / totalSeconds) * chartWidth);
  const y = (value: number) => {
    const ratio = (value - domainMin) / span;
    return axis.invert
      ? PADDING.top + ratio * chartHeight
      : PADDING.top + (1 - ratio) * chartHeight;
  };

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.seconds).toFixed(1)} ${y(p.value).toFixed(1)}`)
    .join(" ");
  const bottomY = (PADDING.top + chartHeight).toFixed(1);
  const areaPath = `${linePath} L ${x(points[points.length - 1].seconds).toFixed(1)} ${bottomY} L ${x(points[0].seconds).toFixed(1)} ${bottomY} Z`;

  const valueTicks = [domainMin, (domainMin + domainMax) / 2, domainMax];
  const timeTicks = totalSeconds > 0 ? [0, totalSeconds / 2, totalSeconds] : [0];
  const gradientId = `dive-chart-fill-${axis.unit}`;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto text-foreground" role="img" aria-label={axis.chartLabel}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={axis.color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={axis.color} stopOpacity={0} />
        </linearGradient>
      </defs>

      {valueTicks.map((v) => (
        <g key={v}>
          <line
            x1={PADDING.left} x2={WIDTH - PADDING.right}
            y1={y(v)} y2={y(v)}
            stroke="currentColor" strokeOpacity={0.12} strokeDasharray="4 4"
          />
          <text x={PADDING.left - 6} y={y(v) + 3} textAnchor="end" fontSize="9" fill="currentColor" opacity={0.55}>
            {Math.round(v)}{axis.unit}
          </text>
        </g>
      ))}
      {timeTicks.map((sec) => (
        <text key={sec} x={x(sec)} y={HEIGHT - 8} textAnchor="middle" fontSize="9" fill="currentColor" opacity={0.55}>
          {formatMinutes(sec)}
        </text>
      ))}

      <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
      <path d={linePath} fill="none" stroke={axis.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

      {extra}
    </svg>
  );
}

export function DiveProfileChart({ samples }: { samples: ProfileSample[] }) {
  const { t } = useT();
  if (samples.length < 2) return null;

  const totalSeconds = samples[samples.length - 1].seconds;
  const deepest = samples.reduce((max, s) => (s.depth > max.depth ? s : max));
  const safetyStop = findSafetyStopRange(samples);

  const chartWidth = WIDTH - PADDING.left - PADDING.right;
  const chartHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const maxDepthRaw = Math.max(...samples.map((s) => s.depth));
  const maxDepth = Math.max(5, Math.ceil(maxDepthRaw / 5) * 5);
  const x = (seconds: number) =>
    PADDING.left + (totalSeconds === 0 ? 0 : (seconds / totalSeconds) * chartWidth);
  const y = (depth: number) => PADDING.top + (depth / maxDepth) * chartHeight;

  const safetyStopSegment =
    safetyStop &&
    samples
      .filter((s) => s.seconds >= safetyStop.startSeconds && s.seconds <= safetyStop.endSeconds)
      .map((s, i) => `${i === 0 ? "M" : "L"} ${x(s.seconds).toFixed(1)} ${y(s.depth).toFixed(1)}`)
      .join(" ");

  return (
    <LineChart
      points={samples.map((s) => ({ seconds: s.seconds, value: s.depth }))}
      totalSeconds={totalSeconds}
      axis={{
        color: DEPTH_COLOR,
        unit: "m",
        invert: true,
        chartLabel: t.diveProfileChartLabel,
        emptyLabel: "",
      }}
      extra={
        <>
          {safetyStopSegment && (
            <path d={safetyStopSegment} fill="none" stroke={SAFETY_STOP_COLOR} strokeWidth={3.5} strokeLinecap="round" />
          )}
          <circle cx={x(deepest.seconds)} cy={y(deepest.depth)} r={3.5} fill={DEPTH_COLOR} stroke="white" strokeWidth={1.5} />
          <LabelPill
            cx={x(deepest.seconds)}
            cy={Math.max(y(deepest.depth) - 8, PADDING.top + 24)}
            lines={[
              { text: t.diveProfileMaxDepth, fontSize: 8, color: DEPTH_COLOR, opacity: 0.75 },
              { text: `${deepest.depth}m`, fontSize: 9, weight: 600, color: DEPTH_COLOR },
            ]}
          />
          {safetyStop && (
            <LabelPill
              cx={x((safetyStop.startSeconds + safetyStop.endSeconds) / 2)}
              cy={y(5) - 4}
              lines={[{ text: t.diveProfileSafetyStop, fontSize: 8, weight: 600, color: SAFETY_STOP_COLOR }]}
            />
          )}
        </>
      }
    />
  );
}

export function DiveTempChart({ samples }: { samples: ProfileSample[] }) {
  const { t } = useT();
  const points = samples
    .filter((s): s is ProfileSample & { temp: number } => s.temp != null)
    .map((s) => ({ seconds: s.seconds, value: s.temp }));
  const totalSeconds = samples[samples.length - 1]?.seconds ?? 0;

  return (
    <LineChart
      points={points}
      totalSeconds={totalSeconds}
      axis={{
        color: TEMP_COLOR,
        unit: "°",
        invert: false,
        chartLabel: t.diveProfileTempChartLabel,
        emptyLabel: t.diveProfileNoTempData,
      }}
    />
  );
}

export function DiveNdlChart({ samples }: { samples: ProfileSample[] }) {
  const { t } = useT();
  const points = samples
    .filter((s): s is ProfileSample & { ndlMinutes: number } => s.ndlMinutes != null)
    .map((s) => ({ seconds: s.seconds, value: Math.min(s.ndlMinutes, NDL_DISPLAY_CAP) }));
  const totalSeconds = samples[samples.length - 1]?.seconds ?? 0;
  const hasUncapped = points.some((p) => p.value >= NDL_DISPLAY_CAP);

  return (
    <div className="space-y-1">
      <LineChart
        points={points}
        totalSeconds={totalSeconds}
        axis={{
          color: NDL_COLOR,
          unit: "'",
          invert: false,
          floor: 0,
          chartLabel: t.diveProfileNdlChartLabel,
          emptyLabel: t.diveProfileNoNdlData,
        }}
      />
      {hasUncapped && (
        <p className="text-xs text-muted-foreground text-center">
          {NDL_DISPLAY_CAP}+ = {t.diveProfileNdlUnlimited}
        </p>
      )}
    </div>
  );
}
