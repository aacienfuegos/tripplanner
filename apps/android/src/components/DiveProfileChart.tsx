import { View } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Path, Line, Circle, Text as SvgText } from "react-native-svg";
import { useColorScheme } from "nativewind";
import { DiveProfileSample } from "@/db/dive-logs";
import { useT } from "@/contexts/I18nContext";

const WIDTH = 320;
const HEIGHT = 220;
const PADDING = { top: 14, right: 12, bottom: 24, left: 30 };
const SAFETY_STOP_DEPTH = 5;
const COLOR = "#0e7490";

function formatMinutes(seconds: number): string {
  return `${Math.round(seconds / 60)}min`;
}

export default function DiveProfileChart({ samples }: { samples: DiveProfileSample[] }) {
  const { t } = useT();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const gridColor = isDark ? "#3f3f46" : "#e5e7eb";
  const labelColor = isDark ? "#a1a1aa" : "#6b7280";

  if (samples.length < 2) return null;

  const totalSeconds = samples[samples.length - 1].seconds;
  const maxDepthRaw = Math.max(...samples.map((s) => s.depth));
  const maxDepth = Math.max(5, Math.ceil(maxDepthRaw / 5) * 5);
  const hasSafetyStop = maxDepthRaw > SAFETY_STOP_DEPTH;

  const chartWidth = WIDTH - PADDING.left - PADDING.right;
  const chartHeight = HEIGHT - PADDING.top - PADDING.bottom;

  const x = (seconds: number) =>
    PADDING.left + (totalSeconds === 0 ? 0 : (seconds / totalSeconds) * chartWidth);
  const y = (depth: number) => PADDING.top + (depth / maxDepth) * chartHeight;

  const linePath = samples
    .map((s, i) => `${i === 0 ? "M" : "L"} ${x(s.seconds).toFixed(1)} ${y(s.depth).toFixed(1)}`)
    .join(" ");
  const bottomY = (PADDING.top + chartHeight).toFixed(1);
  const areaPath = `${linePath} L ${x(totalSeconds).toFixed(1)} ${bottomY} L ${x(0).toFixed(1)} ${bottomY} Z`;

  const deepest = samples.reduce((max, s) => (s.depth > max.depth ? s : max));
  const depthTicks = [0, maxDepth / 2, maxDepth];
  const timeTicks = totalSeconds > 0 ? [0, totalSeconds / 2, totalSeconds] : [0];

  return (
    <View accessibilityLabel={t.diveProfileChartLabel}>
      <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <Defs>
          <LinearGradient id="profileFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={COLOR} stopOpacity={0.35} />
            <Stop offset="100%" stopColor={COLOR} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {depthTicks.map((d) => (
          <Line
            key={d}
            x1={PADDING.left} x2={WIDTH - PADDING.right}
            y1={y(d)} y2={y(d)}
            stroke={gridColor} strokeWidth={1} strokeDasharray="4 4"
          />
        ))}
        {depthTicks.map((d) => (
          <SvgText key={`label-${d}`} x={PADDING.left - 4} y={y(d) + 3} fontSize={9} fill={labelColor} textAnchor="end">
            {Math.round(d)}m
          </SvgText>
        ))}
        {timeTicks.map((sec) => (
          <SvgText key={sec} x={x(sec)} y={HEIGHT - 8} fontSize={9} fill={labelColor} textAnchor="middle">
            {formatMinutes(sec)}
          </SvgText>
        ))}

        {hasSafetyStop && (
          <Line
            x1={PADDING.left} x2={WIDTH - PADDING.right}
            y1={y(SAFETY_STOP_DEPTH)} y2={y(SAFETY_STOP_DEPTH)}
            stroke="#f59e0b" strokeWidth={1} strokeOpacity={0.7} strokeDasharray="3 3"
          />
        )}

        <Path d={areaPath} fill="url(#profileFill)" stroke="none" />
        <Path d={linePath} fill="none" stroke={COLOR} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        <Circle cx={x(deepest.seconds)} cy={y(deepest.depth)} r={3.5} fill={COLOR} stroke="white" strokeWidth={1.5} />
        <SvgText x={x(deepest.seconds)} y={y(deepest.depth) - 8} fontSize={9} fontWeight="600" fill={COLOR} textAnchor="middle">
          {deepest.depth}m
        </SvgText>
      </Svg>
    </View>
  );
}
