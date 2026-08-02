import { View, Text } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Path, Line, Circle, Rect, Text as SvgText, G } from "react-native-svg";
import { useColorScheme } from "nativewind";
import { DiveProfileSample } from "@/db/dive-logs";
import { findSafetyStopRange } from "@/lib/dive-profile";
import { useT } from "@/contexts/I18nContext";

const WIDTH = 320;
const HEIGHT = 220;
const PADDING = { top: 14, right: 12, bottom: 24, left: 30 };
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
  gridColor: string;
  labelColor: string;
}

// Pill de fondo para que una etiqueta sea legible sin importar qué haya
// detrás (la línea de la curva, el área rellena, otra etiqueta). El ancho es
// una estimación por nº de caracteres — no hay medición real de texto en SVG.
function LabelPill({
  cx,
  cy,
  bg,
  lines,
}: {
  cx: number;
  cy: number;
  bg: string;
  lines: { text: string; fontSize: number; weight?: string; color?: string; opacity?: number }[];
}) {
  const widths = lines.map((l) => l.text.length * l.fontSize * 0.62);
  const width = Math.max(...widths) + 14;
  const lineHeight = Math.max(...lines.map((l) => l.fontSize)) + 5;
  const height = lines.length * lineHeight + 6;
  const top = cy - height;

  return (
    <G>
      <Rect x={cx - width / 2} y={top} width={width} height={height} rx={5} fill={bg} opacity={0.92} />
      {lines.map((l, i) => (
        <SvgText
          key={i}
          x={cx}
          y={top + lineHeight * (i + 1) - 4}
          textAnchor="middle"
          fontSize={l.fontSize}
          fontWeight={l.weight ?? "400"}
          fill={l.color ?? "currentColor"}
          opacity={l.opacity ?? 1}
        >
          {l.text}
        </SvgText>
      ))}
    </G>
  );
}

function LineChart({
  points,
  totalSeconds,
  axis,
  gradientId,
  extra,
}: {
  points: { seconds: number; value: number }[];
  totalSeconds: number;
  axis: AxisConfig;
  gradientId: string;
  extra?: React.ReactNode;
}) {
  if (points.length < 2) {
    return (
      <View className="py-10">
        <Text className="text-sm text-center text-slate-500 dark:text-slate-400">{axis.emptyLabel}</Text>
      </View>
    );
  }

  const values = points.map((p) => p.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const domainMin = axis.invert ? 0 : Math.max(axis.floor ?? -Infinity, Math.floor(rawMin - 1));
  const domainMax = axis.invert ? Math.max(5, Math.ceil(rawMax / 5) * 5) : Math.ceil(rawMax + 1);
  const span = domainMax - domainMin || 1;

  const chartWidth = WIDTH - PADDING.left - PADDING.right;
  const chartHeight = HEIGHT - PADDING.top - PADDING.bottom;

  const x = (seconds: number) =>
    PADDING.left + (totalSeconds === 0 ? 0 : (seconds / totalSeconds) * chartWidth);
  const y = (value: number) => {
    const ratio = (value - domainMin) / span;
    return axis.invert ? PADDING.top + ratio * chartHeight : PADDING.top + (1 - ratio) * chartHeight;
  };

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.seconds).toFixed(1)} ${y(p.value).toFixed(1)}`)
    .join(" ");
  const bottomY = (PADDING.top + chartHeight).toFixed(1);
  const areaPath = `${linePath} L ${x(points[points.length - 1].seconds).toFixed(1)} ${bottomY} L ${x(points[0].seconds).toFixed(1)} ${bottomY} Z`;

  const valueTicks = [domainMin, (domainMin + domainMax) / 2, domainMax];
  const timeTicks = totalSeconds > 0 ? [0, totalSeconds / 2, totalSeconds] : [0];

  return (
    <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={axis.color} stopOpacity={0.35} />
          <Stop offset="100%" stopColor={axis.color} stopOpacity={0} />
        </LinearGradient>
      </Defs>

      {valueTicks.map((v) => (
        <Line
          key={v}
          x1={PADDING.left} x2={WIDTH - PADDING.right}
          y1={y(v)} y2={y(v)}
          stroke={axis.gridColor} strokeWidth={1} strokeDasharray="4 4"
        />
      ))}
      {valueTicks.map((v) => (
        <SvgText key={`label-${v}`} x={PADDING.left - 4} y={y(v) + 3} fontSize={9} fill={axis.labelColor} textAnchor="end">
          {Math.round(v)}{axis.unit}
        </SvgText>
      ))}
      {timeTicks.map((sec) => (
        <SvgText key={sec} x={x(sec)} y={HEIGHT - 8} fontSize={9} fill={axis.labelColor} textAnchor="middle">
          {formatMinutes(sec)}
        </SvgText>
      ))}

      <Path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
      <Path d={linePath} fill="none" stroke={axis.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

      {extra}
    </Svg>
  );
}

function useAxisColors() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  return {
    gridColor: isDark ? "#3f3f46" : "#e5e7eb",
    labelColor: isDark ? "#a1a1aa" : "#6b7280",
    // Mismo fondo que la card que envuelve el gráfico (bg-white dark:bg-zinc-900).
    cardBg: isDark ? "#18181b" : "#ffffff",
  };
}

export default function DiveProfileChart({ samples }: { samples: DiveProfileSample[] }) {
  const { t } = useT();
  const { gridColor, labelColor, cardBg } = useAxisColors();
  if (samples.length < 2) return null;

  const totalSeconds = samples[samples.length - 1].seconds;
  const deepest = samples.reduce((max, s) => (s.depth > max.depth ? s : max));
  const safetyStop = findSafetyStopRange(samples);

  const maxDepthRaw = Math.max(...samples.map((s) => s.depth));
  const maxDepth = Math.max(5, Math.ceil(maxDepthRaw / 5) * 5);
  const chartWidth = WIDTH - PADDING.left - PADDING.right;
  const chartHeight = HEIGHT - PADDING.top - PADDING.bottom;
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
    <View accessibilityLabel={t.diveProfileChartLabel}>
      <LineChart
        points={samples.map((s) => ({ seconds: s.seconds, value: s.depth }))}
        totalSeconds={totalSeconds}
        gradientId="profileFill"
        axis={{ color: DEPTH_COLOR, unit: "m", invert: true, chartLabel: t.diveProfileChartLabel, emptyLabel: "", gridColor, labelColor }}
        extra={
          <>
            {safetyStopSegment && (
              <Path d={safetyStopSegment} fill="none" stroke={SAFETY_STOP_COLOR} strokeWidth={3.5} strokeLinecap="round" />
            )}
            <Circle cx={x(deepest.seconds)} cy={y(deepest.depth)} r={3.5} fill={DEPTH_COLOR} stroke="white" strokeWidth={1.5} />
            <LabelPill
              cx={x(deepest.seconds)}
              cy={Math.max(y(deepest.depth) - 8, PADDING.top + 24)}
              bg={cardBg}
              lines={[
                { text: t.diveProfileMaxDepth, fontSize: 8, color: DEPTH_COLOR, opacity: 0.75 },
                { text: `${deepest.depth}m`, fontSize: 9, weight: "600", color: DEPTH_COLOR },
              ]}
            />
            {safetyStop && (
              <LabelPill
                cx={x((safetyStop.startSeconds + safetyStop.endSeconds) / 2)}
                cy={y(5) - 4}
                bg={cardBg}
                lines={[{ text: t.diveProfileSafetyStop, fontSize: 8, weight: "600", color: SAFETY_STOP_COLOR }]}
              />
            )}
          </>
        }
      />
    </View>
  );
}

export function DiveTempChart({ samples }: { samples: DiveProfileSample[] }) {
  const { t } = useT();
  const { gridColor, labelColor } = useAxisColors();
  const points = samples
    .filter((s): s is DiveProfileSample & { temp: number } => s.temp != null)
    .map((s) => ({ seconds: s.seconds, value: s.temp }));
  const totalSeconds = samples[samples.length - 1]?.seconds ?? 0;

  return (
    <View accessibilityLabel={t.diveProfileTempChartLabel}>
      <LineChart
        points={points}
        totalSeconds={totalSeconds}
        gradientId="tempFill"
        axis={{ color: TEMP_COLOR, unit: "°", invert: false, chartLabel: t.diveProfileTempChartLabel, emptyLabel: t.diveProfileNoTempData, gridColor, labelColor }}
      />
    </View>
  );
}

export function DiveNdlChart({ samples }: { samples: DiveProfileSample[] }) {
  const { t } = useT();
  const { gridColor, labelColor } = useAxisColors();
  const points = samples
    .filter((s): s is DiveProfileSample & { ndlMinutes: number } => s.ndlMinutes != null)
    .map((s) => ({ seconds: s.seconds, value: Math.min(s.ndlMinutes, NDL_DISPLAY_CAP) }));
  const totalSeconds = samples[samples.length - 1]?.seconds ?? 0;
  const hasUncapped = points.some((p) => p.value >= NDL_DISPLAY_CAP);

  return (
    <View accessibilityLabel={t.diveProfileNdlChartLabel}>
      <LineChart
        points={points}
        totalSeconds={totalSeconds}
        gradientId="ndlFill"
        axis={{ color: NDL_COLOR, unit: "'", invert: false, floor: 0, chartLabel: t.diveProfileNdlChartLabel, emptyLabel: t.diveProfileNoNdlData, gridColor, labelColor }}
      />
      {hasUncapped && (
        <Text className="text-xs text-center text-slate-500 dark:text-slate-400 mt-1">
          {NDL_DISPLAY_CAP}+ = {t.diveProfileNdlUnlimited}
        </Text>
      )}
    </View>
  );
}
