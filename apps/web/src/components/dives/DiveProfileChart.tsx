"use client";

import type { ProfileSample } from "@/lib/dive-profile";
import { useT } from "@/contexts/LanguageContext";

const WIDTH = 640;
const HEIGHT = 260;
const PADDING = { top: 16, right: 16, bottom: 26, left: 34 };
const SAFETY_STOP_DEPTH = 5;
const COLOR = "#0e7490";

function formatMinutes(seconds: number): string {
  return `${Math.round(seconds / 60)}min`;
}

export function DiveProfileChart({ samples }: { samples: ProfileSample[] }) {
  const { t } = useT();
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
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full h-auto text-foreground"
      role="img"
      aria-label={t.diveProfileChartLabel}
    >
      <defs>
        <linearGradient id="dive-profile-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={COLOR} stopOpacity={0.35} />
          <stop offset="100%" stopColor={COLOR} stopOpacity={0} />
        </linearGradient>
      </defs>

      {depthTicks.map((d) => (
        <g key={d}>
          <line
            x1={PADDING.left} x2={WIDTH - PADDING.right}
            y1={y(d)} y2={y(d)}
            stroke="currentColor" strokeOpacity={0.12} strokeDasharray="4 4"
          />
          <text x={PADDING.left - 6} y={y(d) + 3} textAnchor="end" fontSize="9" fill="currentColor" opacity={0.55}>
            {Math.round(d)}m
          </text>
        </g>
      ))}
      {timeTicks.map((sec) => (
        <text key={sec} x={x(sec)} y={HEIGHT - 8} textAnchor="middle" fontSize="9" fill="currentColor" opacity={0.55}>
          {formatMinutes(sec)}
        </text>
      ))}

      {hasSafetyStop && (
        <line
          x1={PADDING.left} x2={WIDTH - PADDING.right}
          y1={y(SAFETY_STOP_DEPTH)} y2={y(SAFETY_STOP_DEPTH)}
          stroke="#f59e0b" strokeOpacity={0.7} strokeDasharray="3 3"
        />
      )}

      <path d={areaPath} fill="url(#dive-profile-fill)" stroke="none" />
      <path d={linePath} fill="none" stroke={COLOR} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

      <circle cx={x(deepest.seconds)} cy={y(deepest.depth)} r={3.5} fill={COLOR} stroke="white" strokeWidth={1.5} />
      <text x={x(deepest.seconds)} y={y(deepest.depth) - 8} textAnchor="middle" fontSize="9" fontWeight={600} fill={COLOR}>
        {deepest.depth}m
      </text>
    </svg>
  );
}
