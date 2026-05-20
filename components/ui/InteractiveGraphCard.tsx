"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { motion } from "framer-motion";
import { BarChart3, Minus, Plus } from "lucide-react";
import type {
  GraphArtifact,
  GraphCategoryValue,
  GraphPoint,
  GraphSeries,
  GraphSeriesParameter,
} from "@/lib/graphs/types";
import { sampleExpression, substituteGraphParameters } from "@/lib/graphs/expression";
import { sampleCirclePoints, sampleEllipsePoints } from "@/lib/graphs/parametric";

const WIDTH = 760;
const HEIGHT = 380;
const M = { top: 30, right: 28, bottom: 52, left: 58 };
const INNER_W = WIDTH - M.left - M.right;
const INNER_H = HEIGHT - M.top - M.bottom;
const PARAM_HARD_LIMIT = 1000;
const PARAM_MIN_SLIDER_SPAN = 20;

type ViewBox = { xMin: number; xMax: number; yMin: number; yMax: number };
type Hover =
  | { kind: "cartesian"; sx: number; sy: number; label: string; value: string }
  | { kind: "category"; sx: number; sy: number; label: string; value: string }
  | null;

function niceTicks(min: number, max: number, count = 6): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return [min || 0];
  const span = max - min;
  const raw = span / Math.max(1, count - 1);
  const power = Math.pow(10, Math.floor(Math.log10(raw)));
  const fraction = raw / power;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  const step = nice * power;
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.5; v += step) ticks.push(Number(v.toPrecision(12)));
  return ticks.slice(0, 10);
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1000 || (Math.abs(n) > 0 && Math.abs(n) < 0.01)) return n.toExponential(2);
  return Number.isInteger(n) ? String(n) : n.toFixed(Math.abs(n) < 10 ? 2 : 1).replace(/\.0+$/, "");
}

function graphTypeLabel(type: GraphArtifact["type"]): string {
  return `${type.charAt(0).toUpperCase()}${type.slice(1)} Graph`;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function paramInputKey(seriesId: string, paramId: string): string {
  return `${seriesId}:${paramId}`;
}

function sanitizeParamInput(raw: string, allowNegative: boolean): string {
  let out = "";
  let hasDot = false;
  for (const ch of raw.slice(0, 14)) {
    if (ch >= "0" && ch <= "9") {
      out += ch;
      continue;
    }
    if (ch === "." && !hasDot) {
      hasDot = true;
      out += ch;
      continue;
    }
    if (ch === "-" && allowNegative && out.length === 0) {
      out = "-";
    }
  }
  return out;
}

function parseCompleteParamInput(value: string): number | null {
  if (!value || value === "-" || value === "." || value === "-.") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function effectiveParamRange(param: GraphSeriesParameter, value: number): { min: number; max: number; step: number } {
  const explicitMin = param.min;
  const explicitMax = param.max;
  const defaultMin = Math.min(param.defaultValue - 10, -10);
  const defaultMax = Math.max(param.defaultValue + 10, 10);
  let min = explicitMin ?? defaultMin;
  let max = explicitMax ?? defaultMax;
  if (min > max) [min, max] = [max, min];

  const positiveOnly = min >= 0 && param.defaultValue >= 0;
  if (max - min < PARAM_MIN_SLIDER_SPAN) {
    if (!positiveOnly && min < 0 && max > 0) {
      min = -PARAM_MIN_SLIDER_SPAN / 2;
      max = PARAM_MIN_SLIDER_SPAN / 2;
    } else {
      min = param.defaultValue - PARAM_MIN_SLIDER_SPAN / 2;
      max = param.defaultValue + PARAM_MIN_SLIDER_SPAN / 2;
    }
    if (positiveOnly) {
      min = 0;
      max = Math.max(PARAM_MIN_SLIDER_SPAN, max);
    }
  }

  min = Math.min(min, value);
  max = Math.max(max, value);
  min = positiveOnly ? Math.max(0, min) : Math.max(-PARAM_HARD_LIMIT, min);
  max = Math.min(PARAM_HARD_LIMIT, max);
  if (max <= min) max = Math.min(PARAM_HARD_LIMIT, min + PARAM_MIN_SLIDER_SPAN);

  const span = max - min;
  const step = param.step ?? (span > 100 ? 1 : span > 20 ? 0.5 : 0.1);
  return { min, max, step };
}

/** Linear interpolate y at data-x along sampled curve points (sorted by x). */
function yOnCurveAtX(points: GraphPoint[], x: number): number | null {
  const finite = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (finite.length === 0) return null;
  if (x <= finite[0].x) return finite[0].y;
  if (x >= finite[finite.length - 1].x) return finite[finite.length - 1].y;
  for (let i = 0; i < finite.length - 1; i += 1) {
    const a = finite[i];
    const b = finite[i + 1];
    if (x >= a.x && x <= b.x) {
      const t = (x - a.x) / (b.x - a.x || 1e-12);
      return a.y + t * (b.y - a.y);
    }
  }
  return null;
}

function nearestPointByX(points: GraphPoint[], x: number): GraphPoint | null {
  let best: GraphPoint | null = null;
  let bd = Infinity;
  for (const pt of points) {
    if (!Number.isFinite(pt.x) || !Number.isFinite(pt.y)) continue;
    const d = Math.abs(pt.x - x);
    if (d < bd) {
      bd = d;
      best = pt;
    }
  }
  return best;
}

function padDomain(min: number, max: number): [number, number] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [-10, 10];
  if (min === max) return [min - 1, max + 1];
  const pad = (max - min) * 0.12;
  return [min - pad, max + pad];
}

function finiteExtent(values: number[]): [number, number] | null {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return null;
  return [Math.min(...finite), Math.max(...finite)];
}

function percentileExtent(values: number[], low = 0.02, high = 0.98): [number, number] | null {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (finite.length === 0) return null;
  const lo = finite[Math.floor((finite.length - 1) * low)];
  const hi = finite[Math.ceil((finite.length - 1) * high)];
  return lo === hi ? [lo - 1, hi + 1] : [lo, hi];
}

function parameterValueSets(series: GraphSeries): Array<Record<string, number>> {
  if (!series.parameters?.length) return [{}];
  const defaults = Object.fromEntries(series.parameters.map((p) => [p.id, p.defaultValue]));
  const sets: Array<Record<string, number>> = [defaults];
  for (const param of series.parameters) {
    for (const value of [param.min, param.max]) {
      if (value == null || !Number.isFinite(value) || value === param.defaultValue) continue;
      sets.push({ ...defaults, [param.id]: value });
    }
  }
  return sets.slice(0, 9);
}

function fitAxisRange(
  axis: { min?: number; max?: number } | undefined,
  dataExtent: [number, number] | null,
  fallback: [number, number],
  options: { preserveExplicitMin?: boolean; preserveExplicitMax?: boolean; padRatio?: number } = {},
): [number, number] {
  let min = Math.min(axis?.min ?? fallback[0], dataExtent?.[0] ?? fallback[0]);
  let max = Math.max(axis?.max ?? fallback[1], dataExtent?.[1] ?? fallback[1]);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    [min, max] = padDomain(Number.isFinite(min) ? min : fallback[0], Number.isFinite(max) ? max : fallback[1]);
  }

  const span = Math.max(max - min, 1e-9);
  const pad = span * (options.padRatio ?? 0.1);
  const explicitMin = axis?.min;
  const explicitMax = axis?.max;
  const dataMin = dataExtent?.[0];
  const dataMax = dataExtent?.[1];

  const keepMin =
    options.preserveExplicitMin &&
    explicitMin != null &&
    (dataMin == null || dataMin >= explicitMin);
  const keepMax =
    options.preserveExplicitMax &&
    explicitMax != null &&
    (dataMax == null || dataMax <= explicitMax);

  return [keepMin ? explicitMin : min - pad, keepMax ? explicitMax : max + pad];
}

/** Places Cartesian hover card near the marker without clipping awkwardly at plot edges. */
function cartesianInspectTooltipPosition(sx: number, sy: number): CSSProperties {
  const pctX = (sx / WIDTH) * 100;
  const pctY = (sy / HEIGHT) * 100;
  const roomAbove = sy > M.top + 56;
  const nearLeft = sx < WIDTH * 0.24;
  const nearRight = sx > WIDTH * 0.76;

  if (nearLeft) {
    return {
      left: 12,
      top: `${pctY}%`,
      transform: roomAbove ? "translateY(calc(-100% - 14px))" : "translateY(16px)",
    };
  }
  if (nearRight) {
    return {
      right: 12,
      left: "auto",
      top: `${pctY}%`,
      transform: roomAbove ? "translateY(calc(-100% - 14px))" : "translateY(16px)",
    };
  }
  return {
    left: `${pctX}%`,
    top: `${pctY}%`,
    transform: roomAbove ? "translate(-50%, calc(-100% - 14px))" : "translate(-50%, 16px)",
  };
}

/**
 * Adjust view so x and y have the same pixels-per-unit scale.
 * Fixes circles rendered as ovals on wide plots.
 * Keeps the y range fixed; expands/contracts x to match.
 */
function enforceEqualAspect(view: ViewBox): ViewBox {
  const xSpan = view.xMax - view.xMin;
  const ySpan = view.yMax - view.yMin;
  if (xSpan <= 0 || ySpan <= 0) return view;
  // Target x span so that px/unit is the same on both axes
  const targetXSpan = (INNER_W / INNER_H) * ySpan;
  if (Math.abs(targetXSpan - xSpan) / xSpan < 0.001) return view; // already close enough
  const cx = (view.xMin + view.xMax) / 2;
  return {
    xMin: cx - targetXSpan / 2,
    xMax: cx + targetXSpan / 2,
    yMin: view.yMin,
    yMax: view.yMax,
  };
}

function seriesPointsFromResolved(expression: string, graph: GraphArtifact, view: ViewBox): GraphPoint[] {
  if (graph.type !== "function" || !expression) return [];
  const min = view.xMin;
  const max = view.xMax;
  try {
    return sampleExpression(expression, min, max, 220);
  } catch {
    return [];
  }
}

function defaultView(graph: GraphArtifact): ViewBox {
  if (graph.type === "bar" || graph.type === "histogram" || graph.type === "pie") {
    return { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
  }

  const xAxis = graph.xAxis;
  const yAxis = graph.yAxis;
  const allPoints: GraphPoint[] = [];
  for (const s of graph.series) {
    if (graph.type === "function" && s.expression) {
      const min = xAxis?.min ?? -10;
      const max = xAxis?.max ?? 10;
      for (const values of parameterValueSets(s)) {
        const expr = s.parameters?.length ? substituteGraphParameters(s.expression, values) : s.expression;
        allPoints.push(...seriesPointsFromResolved(expr, graph, { xMin: min, xMax: max, yMin: 0, yMax: 1 }));
      }
    } else if (s.circle) {
      const { cx, cy, r } = s.circle;
      allPoints.push({ x: cx - r, y: cy - r }, { x: cx + r, y: cy + r });
    } else if (s.ellipse) {
      const { cx, cy, a, b } = s.ellipse;
      allPoints.push({ x: cx - a, y: cy - b }, { x: cx + a, y: cy + b });
    } else if (s.points?.length) {
      allPoints.push(...s.points);
    }
  }

  // Filter NaN gap markers (inserted by discontinuity detection) before computing bounds
  const finitePoints = allPoints.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  const xExtent = finiteExtent(finitePoints.map((p) => p.x));
  const yExtent = graph.type === "function"
    ? percentileExtent(finitePoints.map((p) => p.y))
    : finiteExtent(finitePoints.map((p) => p.y));
  const [xMin, xMax] = fitAxisRange(xAxis, xExtent, [-10, 10], {
    preserveExplicitMin: xAxis?.min === 0,
    preserveExplicitMax: false,
    padRatio: 0.08,
  });
  const [yMin, yMax] = fitAxisRange(yAxis, yExtent, [-10, 10], {
    preserveExplicitMin: yAxis?.min === 0,
    preserveExplicitMax: false,
    padRatio: 0.12,
  });

  const raw = { xMin, xMax, yMin, yMax };
  return graph.preserveAspectRatio ? enforceEqualAspect(raw) : raw;
}

function makePath(points: GraphPoint[], sx: (x: number) => number, sy: (y: number) => number): string {
  // NaN y-values are gap markers inserted at discontinuities/asymptotes — lift the pen there.
  const cmds: string[] = [];
  let penDown = false;
  for (const p of points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
      penDown = false; // lift pen: start a new sub-path after the gap
      continue;
    }
    cmds.push(`${penDown ? "L" : "M"} ${sx(p.x).toFixed(2)} ${sy(p.y).toFixed(2)}`);
    penDown = true;
  }
  return cmds.join(" ");
}

function areaPath(points: GraphPoint[], sx: (x: number) => number, sy: (y: number) => number, baseline: number): string {
  const path = makePath(points, sx, sy);
  if (!path || points.length === 0) return "";
  const first = points[0];
  const last = points[points.length - 1];
  return `${path} L ${sx(last.x).toFixed(2)} ${sy(baseline).toFixed(2)} L ${sx(first.x).toFixed(2)} ${sy(baseline).toFixed(2)} Z`;
}

function useActiveSeries(series: GraphSeries[]) {
  const [disabled, setDisabled] = useState<Record<string, boolean>>({});
  const active = series.filter((s) => !disabled[s.id]);
  const toggle = (id: string) => setDisabled((prev) => ({ ...prev, [id]: !prev[id] }));
  return { active: active.length ? active : series, disabled, toggle };
}

function categoryData(series: GraphSeries): GraphCategoryValue[] {
  return series.categories ?? [];
}

function initParamMaps(graph: GraphArtifact): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const s of graph.series) {
    if (!s.parameters?.length) continue;
    out[s.id] = {};
    for (const p of s.parameters) {
      out[s.id][p.id] = p.defaultValue;
    }
  }
  return out;
}

/**
 * Substitute current parameter values into the series label for live display.
 * e.g. label="y = x^n", param n=2.5 → "y = x^2.5"
 */
function formatLiveLabel(series: GraphSeries, paramVals: Record<string, number> | undefined): string {
  if (!series.parameters?.length) return series.label;
  let label = series.label;
  for (const param of series.parameters) {
    const val = paramVals?.[param.id] ?? param.defaultValue;
    label = label.replace(new RegExp(`\\b${param.id}\\b`, "g"), fmt(val));
  }
  return label;
}

function resolvedExprForSeries(series: GraphSeries, values: Record<string, number> | undefined): string {
  if (!series.expression) return "";
  if (!series.parameters?.length) return series.expression;
  const vals = Object.fromEntries(
    series.parameters.map((p) => [p.id, values?.[p.id] ?? p.defaultValue]),
  );
  return substituteGraphParameters(series.expression, vals);
}

/** Points actually drawn for Cartesian plots (functions, parametric primitives, or polyline data). */
function cartesianSeriesPoints(
  series: GraphSeries,
  graph: GraphArtifact,
  view: ViewBox,
  paramValues: Record<string, Record<string, number>>,
): GraphPoint[] {
  if (graph.type === "function") {
    const resolved = resolvedExprForSeries(series, paramValues[series.id]);
    return resolved ? seriesPointsFromResolved(resolved, graph, view) : [];
  }
  if (series.circle) return sampleCirclePoints(series.circle);
  if (series.ellipse) return sampleEllipsePoints(series.ellipse);
  return series.points ?? [];
}

function Legend({
  series,
  disabled,
  onToggle,
  variant = "light",
}: {
  series: GraphSeries[];
  disabled: Record<string, boolean>;
  onToggle: (id: string) => void;
  variant?: "light" | "dark";
}) {
  if (series.length <= 1) return null;
  const isDark = variant === "dark";
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {series.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onToggle(s.id)}
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] transition-colors"
          style={{
            color: isDark
              ? disabled[s.id]
                ? "rgba(255,255,255,0.35)"
                : "rgba(255,255,255,0.88)"
              : disabled[s.id]
                ? "var(--base-400)"
                : "var(--base-700)",
            background: disabled[s.id]
              ? "transparent"
              : isDark
                ? "rgba(59,130,246,0.12)"
                : "color-mix(in srgb, var(--primary-400) 10%, transparent)",
          }}
        >
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{
              background: s.color ?? "var(--primary-400)",
              opacity: disabled[s.id] ? 0.35 : 1,
            }}
          />
          {s.label}
        </button>
      ))}
    </div>
  );
}

function ParameterControls({
  graph,
  paramValues,
  onChange,
  variant = "light",
}: {
  graph: GraphArtifact;
  paramValues: Record<string, Record<string, number>>;
  onChange: (seriesId: string, paramId: string, value: number) => void;
  variant?: "light" | "dark";
}) {
  const isDark = variant === "dark";
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const rows: { series: GraphSeries; param: GraphSeriesParameter }[] = [];
  for (const s of graph.series) {
    for (const p of s.parameters ?? []) {
      rows.push({ series: s, param: p });
    }
  }
  if (rows.length === 0) return null;

  // Series that have parameters, for the live equation display
  const seriesWithParams = graph.series.filter((s) => s.parameters?.length);

  return (
    <div
      className="mb-4 overflow-hidden rounded-xl shadow-sm"
      style={{
        border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid var(--base-200)",
        background: isDark ? "rgba(255,255,255,0.03)" : "color-mix(in srgb, var(--base-50, #fafafa) 88%, transparent)",
        boxShadow: isDark ? undefined : "0 1px 2px rgba(15, 23, 42, 0.04)",
      }}
    >
      {/* Live equation display strip */}
      {seriesWithParams.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5"
          style={{
            borderBottom: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid var(--base-200)",
            background: isDark ? "rgba(125,211,252,0.06)" : "color-mix(in srgb, var(--primary-400) 6%, transparent)",
          }}
        >
          {seriesWithParams.map((s) => {
            const liveLabel = formatLiveLabel(s, paramValues[s.id]);
            return (
              <span
                key={s.id}
                className="inline-flex max-w-full items-center rounded-lg border border-(--base-200) bg-white px-2.5 py-1 font-mono text-[11px] font-medium tabular-nums tracking-tight shadow-sm sm:text-[12px]"
                style={{ color: isDark ? "#93c5fd" : "var(--primary-600, #0f52a0)" }}
              >
                {liveLabel}
              </span>
            );
          })}
          <span
            className="ml-auto text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: isDark ? "rgba(147,197,253,0.85)" : "var(--primary-400)" }}
          >
            Drag to explore
          </span>
        </div>
      )}

      {/* Sliders */}
      <div className="flex flex-col gap-1 px-2 pb-3 pt-3 sm:px-4">
        {rows.map(({ series: s, param: p }) => {
          const val = clamp(paramValues[s.id]?.[p.id] ?? p.defaultValue, -PARAM_HARD_LIMIT, PARAM_HARD_LIMIT);
          const { min, max, step } = effectiveParamRange(p, val);
          const pct = ((clamp(val, min, max) - min) / (max - min || 1)) * 100;
          const inputKey = paramInputKey(s.id, p.id);
          const inputValue = draftValues[inputKey] ?? fmt(val);
          const allowNegative = min < 0;
          const showSeriesPrefix =
            s.parameters!.length > 1 || graph.series.filter((x) => x.parameters?.length).length > 1;
          const commitInput = (raw: string) => {
            const parsed = parseCompleteParamInput(raw);
            const next = parsed == null ? p.defaultValue : clamp(parsed, allowNegative ? -PARAM_HARD_LIMIT : 0, PARAM_HARD_LIMIT);
            onChange(s.id, p.id, next);
            setDraftValues((prev) => {
              const copy = { ...prev };
              delete copy[inputKey];
              return copy;
            });
          };
          return (
            <div
              key={`${s.id}-${p.id}`}
              className="rounded-xl px-2 py-2.5 transition-colors hover:bg-[color-mix(in_srgb,var(--base-200)_48%,transparent)]"
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <span
                    className="text-[12px] font-medium leading-snug"
                    style={{
                      color: isDark ? "rgba(255,255,255,0.65)" : "var(--base-600)",
                      fontFamily: "var(--font-inter)",
                    }}
                  >
                    {showSeriesPrefix ? `${s.label} — ${p.label}` : p.label}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={inputValue}
                    onChange={(e) => {
                      let sanitized = sanitizeParamInput(e.target.value, allowNegative);
                      const parsed = parseCompleteParamInput(sanitized);
                      if (parsed != null) {
                        const clamped = clamp(parsed, allowNegative ? -PARAM_HARD_LIMIT : 0, PARAM_HARD_LIMIT);
                        if (clamped !== parsed) sanitized = String(clamped);
                        onChange(s.id, p.id, clamped);
                      }
                      setDraftValues((prev) => ({ ...prev, [inputKey]: sanitized }));
                    }}
                    onBlur={() => commitInput(inputValue)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.currentTarget.blur();
                      } else if (e.key === "Escape") {
                        setDraftValues((prev) => {
                          const copy = { ...prev };
                          delete copy[inputKey];
                          return copy;
                        });
                        e.currentTarget.blur();
                      }
                    }}
                    aria-label={`${showSeriesPrefix ? `${s.label}, ` : ""}${p.label} value`}
                    className="min-w-14 max-w-24 rounded-lg border px-2.5 py-0.5 text-center text-[12px] font-semibold tabular-nums outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] transition-[border-color,box-shadow,background-color]"
                    style={{
                      color: isDark ? "#bfdbfe" : "var(--primary-600, #0f52a0)",
                      borderColor: isDark ? "rgba(255,255,255,0.12)" : "color-mix(in srgb, var(--primary-400) 28%, transparent)",
                      background: isDark ? "rgba(59,130,246,0.2)" : "color-mix(in srgb, var(--primary-400) 12%, transparent)",
                    }}
                  />
                </div>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={clamp(val, min, max)}
                  onChange={(e) => onChange(s.id, p.id, Number(e.target.value))}
                  aria-label={showSeriesPrefix ? `${s.label}, ${p.label}` : p.label}
                  className="lerno-graph-param-slider"
                  style={{
                    accentColor: "var(--primary-400)",
                    background: isDark
                      ? `linear-gradient(to right, #60a5fa 0%, #60a5fa ${pct}%, rgba(255,255,255,0.12) ${pct}%, rgba(255,255,255,0.12) 100%)`
                      : `linear-gradient(to right, var(--primary-400) 0%, var(--primary-400) ${pct}%, var(--base-200) ${pct}%, var(--base-200) 100%)`,
                  }}
                />
                <div
                  className="flex justify-between text-[10px] tabular-nums tracking-wide"
                  style={{ color: isDark ? "rgba(255,255,255,0.35)" : "var(--base-400)", fontFamily: "var(--font-inter)" }}
                >
                  <span>{fmt(min)}</span>
                  <span>{fmt(max)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CartesianGraph({ graph }: { graph: GraphArtifact }) {
  const baselineView = useMemo(() => defaultView(graph), [graph]);
  const [view, setView] = useState<ViewBox>(() => defaultView(graph));
  const [hover, setHover] = useState<Hover>(null);
  const [paramValues, setParamValues] = useState<Record<string, Record<string, number>>>(() => initParamMaps(graph));
  const drag = useRef<{ x: number; y: number; view: ViewBox } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const wheelRef = useRef<HTMLDivElement>(null);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{ d0: number; v0: ViewBox; cx: number; cy: number } | null>(null);
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);
  const clipId = `graph-clip-${graph.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const { active, disabled, toggle } = useActiveSeries(graph.series);

  const sx = useCallback(
    (x: number) => M.left + ((x - view.xMin) / (view.xMax - view.xMin)) * INNER_W,
    [view.xMax, view.xMin],
  );
  const sy = useCallback(
    (y: number) => M.top + INNER_H - ((y - view.yMin) / (view.yMax - view.yMin)) * INNER_H,
    [view.yMax, view.yMin],
  );
  const dx = useCallback(
    (px: number) => view.xMin + ((px - M.left) / INNER_W) * (view.xMax - view.xMin),
    [view.xMax, view.xMin],
  );
  const dy = useCallback(
    (py: number) => view.yMax - ((py - M.top) / INNER_H) * (view.yMax - view.yMin),
    [view.yMax, view.yMin],
  );

  const plotted = useMemo(() => {
    return active.map((series) => ({
      series,
      points: cartesianSeriesPoints(series, graph, view, paramValues),
    }));
  }, [active, graph, paramValues, view]);

  const xTicks = useMemo(() => niceTicks(view.xMin, view.xMax), [view.xMax, view.xMin]);
  const yTicks = useMemo(() => niceTicks(view.yMin, view.yMax), [view.yMax, view.yMin]);

  const zoomAt = useCallback((factor: number, pxSvg: number, pySvg: number) => {
    setView((v) => {
      if (pxSvg < M.left || pxSvg > M.left + INNER_W || pySvg < M.top || pySvg > M.top + INNER_H) {
        const cx = (v.xMin + v.xMax) / 2;
        const cy = (v.yMin + v.yMax) / 2;
        const hw = ((v.xMax - v.xMin) * factor) / 2;
        const hh = ((v.yMax - v.yMin) * factor) / 2;
        return { xMin: cx - hw, xMax: cx + hw, yMin: cy - hh, yMax: cy + hh };
      }
      const dataX = v.xMin + ((pxSvg - M.left) / INNER_W) * (v.xMax - v.xMin);
      const dataY = v.yMax - ((pySvg - M.top) / INNER_H) * (v.yMax - v.yMin);
      const rx = (dataX - v.xMin) / (v.xMax - v.xMin);
      const ry = (dataY - v.yMin) / (v.yMax - v.yMin);
      const spanX = (v.xMax - v.xMin) * factor;
      const spanY = (v.yMax - v.yMin) * factor;
      return {
        xMin: dataX - rx * spanX,
        xMax: dataX + (1 - rx) * spanX,
        yMin: dataY - ry * spanY,
        yMax: dataY + (1 - ry) * spanY,
      };
    });
  }, []);

  useEffect(() => {
    const el = wheelRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / rect.width) * WIDTH;
      const py = ((e.clientY - rect.top) / rect.height) * HEIGHT;
      const zoomFactor = e.deltaY > 0 ? 1.07 : 0.93;
      zoomAt(zoomFactor, px, py);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  function svgPoint(clientX: number, clientY: number): { x: number; y: number } | null {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { x: ((clientX - rect.left) / rect.width) * WIDTH, y: ((clientY - rect.top) / rect.height) * HEIGHT };
  }

  function updatePinchView() {
    const pts = [...pointers.current.values()];
    if (pts.length !== 2 || !pinchRef.current) return;
    const [a, b] = pts;
    const d1 = Math.hypot(a.x - b.x, a.y - b.y);
    if (d1 < 8) return;
    const { d0, v0, cx, cy } = pinchRef.current;
    const r = d0 / d1;
    const spanX = (v0.xMax - v0.xMin) * r;
    const spanY = (v0.yMax - v0.yMin) * r;
    const rx = (cx - v0.xMin) / (v0.xMax - v0.xMin);
    const ry = (cy - v0.yMin) / (v0.yMax - v0.yMin);
    setView({
      xMin: cx - rx * spanX,
      xMax: cx + (1 - rx) * spanX,
      yMin: cy - ry * spanY,
      yMax: cy + (1 - ry) * spanY,
    });
  }

  const handleParamChange = useCallback((seriesId: string, paramId: string, value: number) => {
    setParamValues((prev) => ({
      ...prev,
      [seriesId]: { ...prev[seriesId], [paramId]: value },
    }));
  }, []);

  const zoomIn = useCallback(() => {
    zoomAt(0.93, M.left + INNER_W / 2, M.top + INNER_H / 2);
  }, [zoomAt]);
  const zoomOut = useCallback(() => {
    zoomAt(1.07, M.left + INNER_W / 2, M.top + INNER_H / 2);
  }, [zoomAt]);

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const p = svgPoint(e.clientX, e.clientY);
    if (!p) return;

    if (pointers.current.has(e.pointerId)) {
      pointers.current.set(e.pointerId, p);
    }

    if (pointers.current.size === 2) {
      updatePinchView();
      setHover(null);
      return;
    }

    if (drag.current) {
      const start = drag.current;
      const xSpan = start.view.xMax - start.view.xMin;
      const ySpan = start.view.yMax - start.view.yMin;
      const xShift = ((p.x - start.x) / INNER_W) * xSpan;
      const yShift = ((p.y - start.y) / INNER_H) * ySpan;
      setView({
        xMin: start.view.xMin - xShift,
        xMax: start.view.xMax - xShift,
        yMin: start.view.yMin + yShift,
        yMax: start.view.yMax + yShift,
      });
      return;
    }

    if (p.x < M.left || p.x > M.left + INNER_W || p.y < M.top || p.y > M.top + INNER_H) {
      setHover(null);
      return;
    }
    const xData = dx(p.x);
    let best: { d: number; s: GraphSeries; points: GraphPoint[] } | null = null;
    for (const item of plotted) {
      for (const point of item.points) {
        if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
        const d = Math.abs(point.x - xData);
        if (!best || d < best.d) best = { d, s: item.series, points: item.points };
      }
    }
    const yCurve =
      best != null
        ? yOnCurveAtX(best.points, xData) ?? nearestPointByX(best.points, xData)?.y ?? null
        : null;
    const label = best ? best.s.label : graph.xAxis?.label ?? "x";
    const yMouse = dy(p.y);
    const value =
      best != null && yCurve != null && Number.isFinite(yCurve)
        ? `(${fmt(xData)}, ${fmt(yCurve)})`
        : `(${fmt(xData)}, ${fmt(yMouse)})`;
    const syMarker =
      best != null && yCurve != null && Number.isFinite(yCurve) ? sy(yCurve) : p.y;
    setHover({ kind: "cartesian", sx: p.x, sy: syMarker, label, value });
  }

  const gridStroke = "var(--base-200)";
  const axisStroke = "var(--base-300)";
  const tickFill = "var(--base-500)";
  const axisLabelFill = "var(--base-600)";
  const planeBg = "color-mix(in srgb, var(--base-100) 65%, transparent)";

  return (
    <>
      <ParameterControls graph={graph} paramValues={paramValues} onChange={handleParamChange} />
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-[min(100%,220px)] text-[10px] leading-relaxed sm:max-w-none" style={{ color: "var(--base-400)", fontFamily: "var(--font-inter)" }}>
          Pinch · Ctrl+scroll to zoom · drag to pan
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            aria-label="Zoom in"
            onClick={zoomIn}
            className="flex h-7 w-7 items-center justify-center rounded-md border text-[15px] font-semibold leading-none transition-colors"
            style={{
              color: "var(--base-600)",
              background: "color-mix(in srgb, var(--base-100) 90%, transparent)",
              borderColor: "var(--base-200)",
              fontFamily: "var(--font-inter)",
            }}
          >
            <Plus size={15} strokeWidth={2.4} aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            onClick={zoomOut}
            className="flex h-7 w-7 items-center justify-center rounded-md border text-[15px] font-semibold leading-none transition-colors"
            style={{
              color: "var(--base-600)",
              background: "color-mix(in srgb, var(--base-100) 90%, transparent)",
              borderColor: "var(--base-200)",
              fontFamily: "var(--font-inter)",
            }}
          >
            <Minus size={15} strokeWidth={2.4} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setView(baselineView)}
            className="rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors hover:bg-(--base-100)"
            style={{ color: "var(--base-400)", fontFamily: "var(--font-inter)" }}
          >
            Reset
          </button>
        </div>
      </div>
      <div ref={wheelRef} className="relative transition-opacity duration-300 ease-out" style={{ touchAction: "none" }}>
        <div
          className="overflow-hidden rounded-xl transition-opacity duration-300 ease-out"
          style={{ background: planeBg }}
        >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="block h-auto w-full select-none"
          style={{ touchAction: "none" }}
          onPointerDown={(e) => {
            const p = svgPoint(e.clientX, e.clientY);
            if (!p) return;
            pointers.current.set(e.pointerId, p);
            if (pointers.current.size === 2) {
              const pts = [...pointers.current.values()];
              const [a, b] = pts;
              const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
              const d0 = Math.hypot(a.x - b.x, a.y - b.y);
              const v = viewRef.current;
              const cx = v.xMin + ((mid.x - M.left) / INNER_W) * (v.xMax - v.xMin);
              const cy = v.yMax - ((mid.y - M.top) / INNER_H) * (v.yMax - v.yMin);
              pinchRef.current = { d0: Math.max(d0, 1), v0: { ...v }, cx, cy };
              drag.current = null;
            } else if (pointers.current.size === 1) {
              pinchRef.current = null;
              drag.current = { x: p.x, y: p.y, view: { ...viewRef.current } };
              e.currentTarget.setPointerCapture(e.pointerId);
            }
          }}
          onPointerUp={(e) => {
            pointers.current.delete(e.pointerId);
            if (pointers.current.size < 2) pinchRef.current = null;
            drag.current = null;
          }}
          onPointerCancel={(e) => {
            pointers.current.delete(e.pointerId);
            pinchRef.current = null;
            drag.current = null;
          }}
          onPointerLeave={() => {
            if (pointers.current.size === 0) {
              drag.current = null;
              setHover(null);
            }
          }}
          onPointerMove={handlePointerMove}
        >
          <defs>
            <clipPath id={clipId}>
              <rect x={M.left} y={M.top} width={INNER_W} height={INNER_H} rx="6" />
            </clipPath>
          </defs>
          <rect width={WIDTH} height={HEIGHT} fill="transparent" />
          {xTicks.map((t) => (
            <g key={`x-${t}`}>
              <line x1={sx(t)} x2={sx(t)} y1={M.top} y2={M.top + INNER_H} stroke={gridStroke} strokeWidth={1} vectorEffect="non-scaling-stroke" />
              <text x={sx(t)} y={HEIGHT - 24} textAnchor="middle" fontSize="11" fill={tickFill} style={{ fontFamily: "var(--font-inter)" }}>
                {fmt(t)}
              </text>
            </g>
          ))}
          {yTicks.map((t) => (
            <g key={`y-${t}`}>
              <line x1={M.left} x2={M.left + INNER_W} y1={sy(t)} y2={sy(t)} stroke={gridStroke} strokeWidth={1} vectorEffect="non-scaling-stroke" />
              <text x={M.left - 12} y={sy(t) + 4} textAnchor="end" fontSize="11" fill={tickFill} style={{ fontFamily: "var(--font-inter)" }}>
                {fmt(t)}
              </text>
            </g>
          ))}
          {view.yMin <= 0 && view.yMax >= 0 && (
            <line x1={M.left} x2={M.left + INNER_W} y1={sy(0)} y2={sy(0)} stroke={axisStroke} strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
          )}
          {view.xMin <= 0 && view.xMax >= 0 && (
            <line x1={sx(0)} x2={sx(0)} y1={M.top} y2={M.top + INNER_H} stroke={axisStroke} strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
          )}
          <g clipPath={`url(#${clipId})`}>
            {plotted.map(({ series, points }) => {
              const path = makePath(points, sx, sy);
              if (!path) return null;
              const stroke = series.color ?? "var(--primary-400)";
              if (graph.type === "area") {
                const baseline = clamp(0, view.yMin, view.yMax);
                return (
                  <g key={series.id}>
                    <path d={areaPath(points, sx, sy, baseline)} fill={stroke} opacity="0.14" />
                    <path d={path} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                  </g>
                );
              }
              return (
                <g key={series.id}>
                  {graph.type !== "scatter" && (
                    <path d={path} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                  )}
                  {(graph.type === "scatter" ? points : points.filter((_, i) => i % 18 === 0))
                    .filter((pt) => Number.isFinite(pt.x) && Number.isFinite(pt.y))
                    .map((pt, i) => (
                      <circle key={`${series.id}-${i}`} cx={sx(pt.x)} cy={sy(pt.y)} r={graph.type === "scatter" ? 4 : 2.5} fill={stroke} />
                    ))}
                </g>
              );
            })}
          </g>
          {graph.xAxis?.label && (
            <text x={M.left + INNER_W / 2} y={HEIGHT - 6} textAnchor="middle" fontSize="12" fill={axisLabelFill} style={{ fontFamily: "var(--font-inter)" }}>
              {graph.xAxis.label}
            </text>
          )}
          {graph.yAxis?.label && (
            <text x="16" y={M.top + INNER_H / 2} textAnchor="middle" fontSize="12" fill={axisLabelFill} transform={`rotate(-90 16 ${M.top + INNER_H / 2})`} style={{ fontFamily: "var(--font-inter)" }}>
              {graph.yAxis.label}
            </text>
          )}
          {hover?.kind === "cartesian" && (
            <>
              <line x1={hover.sx} x2={hover.sx} y1={M.top} y2={M.top + INNER_H} stroke="var(--base-300)" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
              <circle cx={hover.sx} cy={hover.sy} r="4.5" fill="var(--primary-600)" stroke="#fff" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            </>
          )}
        </svg>
        </div>
        {hover?.kind === "cartesian" && (
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-none absolute z-20 w-max max-w-[min(272px,calc(100%-24px))] rounded-xl border border-(--base-200) bg-white px-3 py-2 shadow-[0_10px_38px_-10px_rgba(15,23,42,0.22)] ring-1 ring-black/5"
            style={cartesianInspectTooltipPosition(hover.sx, hover.sy)}
          >
            <div className="wrap-break-word font-mono text-[10px] leading-snug tracking-tight text-(--base-600)">{hover.label}</div>
            <div className="mt-2 border-t border-(--base-100) pt-2 text-[11px] font-semibold tabular-nums tracking-tight text-(--base-900)">
              {hover.value}
            </div>
          </div>
        )}
      </div>
      <Legend series={graph.series} disabled={disabled} onToggle={toggle} />
    </>
  );
}

function CategoryGraph({ graph }: { graph: GraphArtifact }) {
  const { active, disabled, toggle } = useActiveSeries(graph.series);
  const [hover, setHover] = useState<Hover>(null);
  const groups = active.map((s) => ({ series: s, values: categoryData(s) }));
  const labels = [...new Set(groups.flatMap((g) => g.values.map((v) => v.label)))].slice(0, 24);
  const max = Math.max(1, ...groups.flatMap((g) => g.values.map((v) => Math.max(0, v.value))));
  const yTicks = niceTicks(0, max, 5);
  const groupW = INNER_W / Math.max(1, labels.length);
  const barW = Math.max(4, Math.min(34, (groupW - 10) / Math.max(1, groups.length)));
  const sy = (y: number) => M.top + INNER_H - (y / Math.max(max, 1)) * INNER_H;

  return (
    <>
      <div className="relative overflow-hidden rounded-xl transition-opacity duration-300 ease-out" style={{ background: "color-mix(in srgb, var(--base-100) 65%, transparent)" }}>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block h-auto w-full" onPointerLeave={() => setHover(null)}>
          <rect width={WIDTH} height={HEIGHT} fill="transparent" />
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={M.left + INNER_W} y1={sy(t)} y2={sy(t)} stroke="var(--base-200)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
              <text x={M.left - 12} y={sy(t) + 4} textAnchor="end" fontSize="11" fill="var(--base-500)" style={{ fontFamily: "var(--font-inter)" }}>
                {fmt(t)}
              </text>
            </g>
          ))}
          {labels.map((label, li) => {
            const x0 = M.left + li * groupW + groupW / 2;
            return (
              <g key={label}>
                <text x={x0} y={HEIGHT - 24} textAnchor="middle" fontSize="11" fill="var(--base-500)" style={{ fontFamily: "var(--font-inter)" }}>
                  {label.slice(0, 12)}
                </text>
                {groups.map((g, gi) => {
                  const value = g.values.find((v) => v.label === label)?.value ?? 0;
                  const h = M.top + INNER_H - sy(value);
                  const x = x0 - ((groups.length * barW) / 2) + gi * barW;
                  return (
                    <rect
                      key={`${g.series.id}-${label}`}
                      x={x}
                      y={sy(value)}
                      width={barW - 2}
                      height={Math.max(1, h)}
                      rx="5"
                      fill={g.series.color ?? "var(--primary-400)"}
                      opacity={graph.type === "histogram" ? 0.85 : 0.92}
                      onPointerEnter={() =>
                        setHover({
                          kind: "category",
                          sx: x + barW / 2,
                          sy: sy(value),
                          label: `${g.series.label}: ${label}`,
                          value: fmt(value),
                        })
                      }
                    />
                  );
                })}
              </g>
            );
          })}
          {graph.xAxis?.label && (
            <text x={M.left + INNER_W / 2} y={HEIGHT - 6} textAnchor="middle" fontSize="12" fill="var(--base-600)" style={{ fontFamily: "var(--font-inter)" }}>
              {graph.xAxis.label}
            </text>
          )}
          {graph.yAxis?.label && (
            <text x="16" y={M.top + INNER_H / 2} textAnchor="middle" fontSize="12" fill="var(--base-600)" transform={`rotate(-90 16 ${M.top + INNER_H / 2})`} style={{ fontFamily: "var(--font-inter)" }}>
              {graph.yAxis.label}
            </text>
          )}
        </svg>
        {hover && (
          <div
            className="pointer-events-none absolute rounded-lg px-3 py-2 text-[12px] shadow-md backdrop-blur-sm"
            style={{
              left: Math.min(hover.sx + 14, WIDTH - 190) / (WIDTH / 100) + "%",
              top: Math.max(hover.sy - 12, 12) / (HEIGHT / 100) + "%",
              background: "color-mix(in srgb, var(--base-100) 92%, transparent)",
              fontFamily: "var(--font-inter)",
            }}
          >
            <div className="font-semibold" style={{ color: "var(--base-800)" }}>
              {hover.label}
            </div>
            <div style={{ color: "var(--base-500)" }}>{hover.value}</div>
          </div>
        )}
      </div>
      <Legend series={graph.series} disabled={disabled} onToggle={toggle} />
    </>
  );
}

function polar(cx: number, cy: number, r: number, angle: number) {
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

function PieGraph({ graph }: { graph: GraphArtifact }) {
  const [hover, setHover] = useState<Hover>(null);
  const series = graph.series[0];
  const values = categoryData(series).filter((v) => v.value > 0);
  const total = values.reduce((sum, v) => sum + v.value, 0) || 1;
  const slices = values.reduce<Array<{ value: GraphCategoryValue; start: number; end: number; slice: number }>>((acc, value) => {
    const start = acc.length > 0 ? acc[acc.length - 1].end : -Math.PI / 2;
    const slice = (value.value / total) * Math.PI * 2;
    return [...acc, { value, start, end: start + slice, slice }];
  }, []);
  const cx = WIDTH / 2;
  const cy = HEIGHT / 2 - 4;
  const r = 118;
  const palette = ["var(--primary-400)", "var(--green-200)", "#F59E0B", "#EF4444", "#06B6D4", "var(--base-700)"];

  return (
    <div className="relative overflow-hidden rounded-xl transition-opacity duration-300 ease-out" style={{ background: "color-mix(in srgb, var(--base-100) 65%, transparent)" }}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block h-auto w-full" onPointerLeave={() => setHover(null)}>
        <rect width={WIDTH} height={HEIGHT} fill="transparent" />
        {slices.map(({ value: v, start, end, slice }, i) => {
          const p1 = polar(cx, cy, r, start);
          const p2 = polar(cx, cy, r, end);
          const large = slice > Math.PI ? 1 : 0;
          const path = `M ${cx} ${cy} L ${p1.x} ${p1.y} A ${r} ${r} 0 ${large} 1 ${p2.x} ${p2.y} Z`;
          const mid = polar(cx, cy, r * 0.68, start + slice / 2);
          const fill = graph.series[i]?.color ?? palette[i % palette.length];
          return (
            <g key={v.label}>
              <path
                d={path}
                fill={fill}
                opacity="0.92"
                onPointerEnter={() =>
                  setHover({ kind: "category", sx: mid.x, sy: mid.y, label: v.label, value: `${fmt(v.value)} (${fmt((v.value / total) * 100)}%)` })
                }
              />
              {slice > 0.35 && (
                <text x={mid.x} y={mid.y + 4} textAnchor="middle" fontSize="12" fontWeight="600" fill="#fff" style={{ fontFamily: "var(--font-inter)" }}>
                  {fmt((v.value / total) * 100)}%
                </text>
              )}
            </g>
          );
        })}
        <circle cx={cx} cy={cy} r="58" fill="var(--base-100)" />
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--base-800)" style={{ fontFamily: "var(--font-inter)" }}>
          Total
        </text>
        <text x={cx} y={cy + 16} textAnchor="middle" fontSize="13" fill="var(--base-500)" style={{ fontFamily: "var(--font-inter)" }}>
          {fmt(total)}
        </text>
      </svg>
      {hover && (
        <div
          className="pointer-events-none absolute rounded-lg px-3 py-2 text-[12px] shadow-md backdrop-blur-sm"
          style={{
            left: Math.min(hover.sx + 14, WIDTH - 190) / (WIDTH / 100) + "%",
            top: Math.max(hover.sy - 12, 12) / (HEIGHT / 100) + "%",
            background: "color-mix(in srgb, var(--base-100) 92%, transparent)",
            fontFamily: "var(--font-inter)",
          }}
        >
          <div className="font-semibold" style={{ color: "var(--base-800)" }}>
            {hover.label}
          </div>
          <div style={{ color: "var(--base-500)" }}>{hover.value}</div>
        </div>
      )}
    </div>
  );
}

function InteractiveGraphCardInner({ graph }: { graph: GraphArtifact }) {
  const isCategory = graph.type === "bar" || graph.type === "histogram";
  const isPie = graph.type === "pie";

  return (
    <motion.section
      key={graph.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
      className="my-4 motion-reduce:opacity-100 motion-reduce:transform-none"
      style={{ fontFamily: "var(--font-inter)" }}
      aria-label={graph.title}
    >
      <div className="mb-5 flex items-start gap-3.5 border-l-4 border-(--primary-300) py-1 pl-4">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--primary-400)_10%,transparent)] text-(--primary-500)">
          <BarChart3 size={18} strokeWidth={2.2} aria-hidden />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[11px] font-semibold uppercase leading-none tracking-[0.18em] text-(--primary-500)">
            {graphTypeLabel(graph.type)}
          </span>
          <h4
            className="text-[18px] font-semibold leading-snug sm:text-[19px]"
            style={{
              color: "var(--base-800)",
              fontFamily: "var(--font-crimson-pro), var(--font-inter), serif",
            }}
          >
            {graph.title}
          </h4>
        </div>
      </div>

      <figure className="m-0 min-w-0">
      {isPie ? (
        <PieGraph key={`${graph.id}-${JSON.stringify(graph.series)}`} graph={graph} />
      ) : isCategory ? (
        <CategoryGraph key={`${graph.id}-${JSON.stringify(graph.series)}`} graph={graph} />
      ) : (
        <CartesianGraph key={`${graph.id}-${JSON.stringify(graph.series)}`} graph={graph} />
      )}

      {graph.description && (
        <figcaption
          className="mt-4 border-t border-(--base-200) pt-3 text-[13px] leading-relaxed text-(--base-600)"
          style={{ fontFamily: "var(--font-crimson-pro), Georgia, 'Times New Roman', serif" }}
        >
          <span className="font-semibold text-(--base-800) not-italic">Fig. </span>
          <span className="italic">{graph.description}</span>
        </figcaption>
      )}
      </figure>

      <div className="my-7 flex items-center gap-3 px-1" aria-hidden>
        <div className="h-px flex-1 bg-linear-to-r from-transparent via-(--primary-400) to-transparent opacity-35" />
        <div
          className="h-2 w-2 shrink-0 rotate-45 rounded-[2px] shadow-[0_0_14px_color-mix(in_srgb,var(--primary-400)_55%,transparent)]"
          style={{
            border: "1px solid color-mix(in srgb, var(--primary-400) 45%, transparent)",
            background: "color-mix(in srgb, var(--primary-400) 22%, transparent)",
          }}
        />
        <div className="h-px flex-1 bg-linear-to-l from-transparent via-(--primary-400) to-transparent opacity-35" />
      </div>

      {graph.notes && (
        <p className="mt-3 text-[12px] leading-5" style={{ color: "var(--base-400)" }}>
          {graph.notes}
        </p>
      )}
    </motion.section>
  );
}

function graphsEqual(a: GraphArtifact, b: GraphArtifact): boolean {
  return (
    a.id === b.id &&
    a.placeholder === b.placeholder &&
    a.title === b.title &&
    (a.description ?? "") === (b.description ?? "") &&
    JSON.stringify(a.series) === JSON.stringify(b.series)
  );
}

export const InteractiveGraphCard = memo(InteractiveGraphCardInner, (prev, next) => graphsEqual(prev.graph, next.graph));
