import {
  compileGraphExpression,
  GRAPH_EXPRESSION_RESERVED_IDS,
  sampleExpression,
  substituteGraphParameters,
} from "@/lib/graphs/expression";
import type {
  GraphArtifact,
  GraphAxis,
  GraphCategoryValue,
  GraphCirclePrimitive,
  GraphEllipsePrimitive,
  GraphKind,
  GraphPoint,
  GraphSeries,
  GraphSeriesParameter,
} from "@/lib/graphs/types";

const GRAPH_TYPES: GraphKind[] = ["function", "line", "scatter", "bar", "area", "histogram", "pie"];
const PALETTE = ["#0F7BFF", "#10B981", "#F59E0B", "#EF4444", "#111827", "#06B6D4"];

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function text(value: unknown, fallback = "", max = 120): string {
  return typeof value === "string" ? value.trim().slice(0, max) : fallback;
}

function finite(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : Number.NaN;
  return Number.isFinite(n) ? n : null;
}

function slug(value: unknown, fallback: string): string {
  const raw = text(value, fallback, 64).toLowerCase();
  const cleaned = raw.replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || fallback;
}

function color(value: unknown, index: number): string {
  const raw = text(value, "", 20);
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw;
  return PALETTE[index % PALETTE.length];
}

function axis(value: unknown, fallback?: GraphAxis): GraphAxis | undefined {
  const raw = asRecord(value);
  const label = text(raw?.label, fallback?.label ?? "", 48);
  const min = finite(raw?.min ?? fallback?.min);
  const max = finite(raw?.max ?? fallback?.max);
  const out: GraphAxis = {};
  if (label) out.label = label;
  if (min != null && max != null && min < max) {
    out.min = min;
    out.max = max;
  }
  return Object.keys(out).length ? out : undefined;
}

function points(value: unknown): GraphPoint[] {
  if (!Array.isArray(value)) return [];
  const out: GraphPoint[] = [];
  for (const raw of value.slice(0, 500)) {
    const row = asRecord(raw);
    const x = finite(row?.x);
    const y = finite(row?.y);
    if (x == null || y == null) continue;
    const label = text(row?.label, "", 80);
    out.push(label ? { x, y, label } : { x, y });
  }
  return out;
}

function categories(value: unknown): GraphCategoryValue[] {
  if (!Array.isArray(value)) return [];
  const out: GraphCategoryValue[] = [];
  for (const raw of value.slice(0, 100)) {
    const row = asRecord(raw);
    const label = text(row?.label ?? row?.x ?? row?.category, "", 48);
    const value = finite(row?.value ?? row?.y);
    if (!label || value == null) continue;
    out.push({ label, value });
  }
  return out;
}

function resolvedFunctionExpression(s: GraphSeries): string {
  if (!s.expression) return "";
  const params = s.parameters;
  if (!params?.length) return s.expression;
  const vals = Object.fromEntries(params.map((p) => [p.id, p.defaultValue]));
  return substituteGraphParameters(s.expression, vals);
}

/** Minimum vertices so scatter plots are not degenerate landmark-only markers. */
/** Scatter with fewer points is almost always degenerate in our UI (e.g. only “center” and “tangency” dots). */
const MIN_POINTS_SCATTER_TOTAL = 6;
const MIN_SAMPLES_FUNCTION = 14;
const MIN_LINE_AREA_TOTAL = 2;
const MIN_AREA_CLOSED = 3;

function flatPoints(series: GraphSeries[]): GraphPoint[] {
  return series.flatMap((s) => {
    if (s.circle) {
      const { cx, cy, r } = s.circle;
      return [
        { x: cx - r, y: cy - r },
        { x: cx + r, y: cy + r },
      ];
    }
    if (s.ellipse) {
      const { cx, cy, a, b } = s.ellipse;
      return [
        { x: cx - a, y: cy - b },
        { x: cx + a, y: cy + b },
      ];
    }
    return s.points ?? [];
  });
}

function pointsHaveSpatialExtent(pts: GraphPoint[]): boolean {
  if (pts.length < 2) return false;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const dx = Math.max(...xs) - Math.min(...xs);
  const dy = Math.max(...ys) - Math.min(...ys);
  return dx > 1e-9 || dy > 1e-9;
}

/**
 * True if the artifact will draw something meaningful in the Cartesian UI.
 * Rejects e.g. scatter with only center + tangency points (no circle/lines drawn).
 */
export function graphArtifactIsRenderable(graph: GraphArtifact): boolean {
  switch (graph.type) {
    case "bar":
    case "histogram":
    case "pie":
      return graph.series.some((s) => (s.categories?.length ?? 0) >= 1);
    case "scatter": {
      const pts = flatPoints(graph.series);
      if (pts.length < MIN_POINTS_SCATTER_TOTAL) return false;
      return pointsHaveSpatialExtent(pts);
    }
    case "line": {
      const pts = flatPoints(graph.series);
      if (pts.length < MIN_LINE_AREA_TOTAL) return false;
      return pointsHaveSpatialExtent(pts);
    }
    case "area": {
      const pts = flatPoints(graph.series);
      if (pts.length < MIN_AREA_CLOSED) return false;
      return pointsHaveSpatialExtent(pts);
    }
    case "function": {
      const xMin = graph.xAxis?.min ?? -10;
      const xMax = graph.xAxis?.max ?? 10;
      if (!(xMax > xMin)) return false;
      for (const s of graph.series) {
        const resolved = resolvedFunctionExpression(s);
        if (!resolved) return false;
        let finite = 0;
        try {
          for (const p of sampleExpression(resolved, xMin, xMax, 56)) {
            if (Number.isFinite(p.y)) finite += 1;
          }
        } catch {
          return false;
        }
        if (finite < MIN_SAMPLES_FUNCTION) return false;
      }
      return graph.series.length > 0;
    }
    default:
      return false;
  }
}

function inferYAxisFromFunctionSeries(series: GraphSeries[], xMin: number, xMax: number): GraphAxis {
  const yValues: number[] = [];
  for (const s of series) {
    if (!s.expression) continue;
    const resolved = resolvedFunctionExpression(s);
    if (!resolved) continue;
    // sampleExpression now includes NaN gap markers — filter to finite values only
    for (const p of sampleExpression(resolved, xMin, xMax, 80)) {
      if (Number.isFinite(p.y)) yValues.push(p.y);
    }
  }
  if (yValues.length === 0) return { min: -10, max: 10 };
  // Use p5–p95 percentile clipping so near-asymptotic extremes don't blow out the y range
  const sorted = [...yValues].sort((a, b) => a - b);
  const p5 = sorted[Math.floor(sorted.length * 0.05)] ?? sorted[0];
  const p95 = sorted[Math.ceil(sorted.length * 0.95 - 1)] ?? sorted[sorted.length - 1];
  if (p5 === p95) return { min: p5 - 1, max: p95 + 1 };
  const pad = (p95 - p5) * 0.15;
  return { min: p5 - pad, max: p95 + pad };
}

function graphParametersFromJson(value: unknown): GraphSeriesParameter[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: GraphSeriesParameter[] = [];
  const seen = new Set<string>();
  for (const raw of value.slice(0, 12)) {
    const row = asRecord(raw);
    const idRaw = text(row?.id, "", 24).toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (!idRaw || GRAPH_EXPRESSION_RESERVED_IDS.has(idRaw) || seen.has(idRaw)) continue;
    seen.add(idRaw);
    const label = text(row?.label, idRaw, 48);
    const defaultValue = finite(row?.defaultValue ?? row?.default);
    if (defaultValue == null) continue;
    let min = finite(row?.min);
    let max = finite(row?.max);
    const step = finite(row?.step);
    if (min != null && max != null && min > max) {
      const t = min;
      min = max;
      max = t;
    }
    const entry: GraphSeriesParameter = {
      id: idRaw,
      label,
      defaultValue,
      ...(min != null ? { min } : {}),
      ...(max != null ? { max } : {}),
      ...(step != null && step > 0 ? { step } : {}),
    };
    out.push(entry);
  }
  return out.length ? out : undefined;
}

function parseCirclePrimitive(raw: Record<string, unknown>): GraphCirclePrimitive | undefined {
  const c = asRecord(raw.circle);
  if (!c) return undefined;
  const cx = finite(c.cx);
  const cy = finite(c.cy);
  const r = finite(c.r);
  const segments = finite(c.segments);
  if (cx == null || cy == null || r == null || !(r > 0)) return undefined;
  const out: GraphCirclePrimitive = { cx, cy, r };
  if (segments != null && segments >= 8 && segments <= 256) out.segments = Math.floor(segments);
  return out;
}

function parseEllipsePrimitive(raw: Record<string, unknown>): GraphEllipsePrimitive | undefined {
  const e = asRecord(raw.ellipse);
  if (!e) return undefined;
  const cx = finite(e.cx);
  const cy = finite(e.cy);
  const a = finite(e.a ?? e.rx);
  const b = finite(e.b ?? e.ry);
  const segments = finite(e.segments);
  if (cx == null || cy == null || a == null || b == null || !(a > 0) || !(b > 0)) return undefined;
  const out: GraphEllipsePrimitive = { cx, cy, a, b };
  if (segments != null && segments >= 8 && segments <= 256) out.segments = Math.floor(segments);
  return out;
}

function validateSeries(rawSeries: unknown, type: GraphKind): GraphSeries[] {
  if (!Array.isArray(rawSeries)) return [];
  const out: GraphSeries[] = [];
  for (const [index, raw] of rawSeries.slice(0, 4).entries()) {
    const row = asRecord(raw);
    if (!row) continue;
    const id = slug(row.id, `series-${index + 1}`);
    const label = text(row.label, `Series ${index + 1}`, 64);
    const base = { id, label, color: color(row.color, index) };

    if (type === "function") {
      const expression = text(row.expression, "", 160).replace(/y\s*=/i, "").trim();
      if (!expression) continue;
      const parameters = graphParametersFromJson(row.parameters);
      const toCompile = parameters?.length
        ? substituteGraphParameters(
            expression,
            Object.fromEntries(parameters.map((p) => [p.id, p.defaultValue])),
          )
        : expression;
      try {
        compileGraphExpression(toCompile);
      } catch {
        continue;
      }
      out.push({ ...base, expression, ...(parameters?.length ? { parameters } : {}) });
      continue;
    }

    if (type === "line" || type === "scatter" || type === "area") {
      const circle = type === "line" ? parseCirclePrimitive(row) : undefined;
      const ellipse =
        type === "line" && !circle ? parseEllipsePrimitive(row) : undefined;
      const pts = points(row.points);

      if (circle) {
        out.push({ ...base, circle });
        continue;
      }
      if (ellipse) {
        out.push({ ...base, ellipse });
        continue;
      }

      if (pts.length < 2 && type !== "scatter") continue;
      if (pts.length < 1) continue;
      out.push({ ...base, points: pts });
      continue;
    }

    const cats = categories(row.categories ?? row.points);
    if (cats.length < 1) continue;
    out.push({ ...base, categories: cats });
  }
  return out;
}

function validateGraph(raw: unknown, placeholders: Set<string>, index: number): GraphArtifact | null {
  const row = asRecord(raw);
  if (!row) return null;
  const placeholder = slug(row.placeholder, "");
  if (!placeholder || !placeholders.has(placeholder)) return null;
  const typeRaw = text(row.type, "", 20) as GraphKind;
  const type = GRAPH_TYPES.includes(typeRaw) ? typeRaw : null;
  if (!type) return null;

  const series = validateSeries(row.series, type);
  if (series.length === 0) return null;

  const title = text(row.title, "Interactive graph", 90);
  const description = text(row.description, "", 220);
  const id = slug(row.id, `${placeholder}-${index + 1}`);

  let xAxis = axis(row.xAxis, type === "function" ? { label: "x", min: -10, max: 10 } : undefined);
  let yAxis = axis(row.yAxis, type === "function" ? { label: "y" } : undefined);
  if (type === "function") {
    const functionXAxis: GraphAxis & { min: number; max: number } = xAxis && xAxis.min != null && xAxis.max != null
      ? { ...xAxis, min: xAxis.min, max: xAxis.max }
      : { label: xAxis?.label ?? "x", min: -10, max: 10 };
    xAxis = functionXAxis;
    if (!yAxis || yAxis.min == null || yAxis.max == null) {
      yAxis = {
        ...(yAxis?.label ? { label: yAxis.label } : { label: "y" }),
        ...inferYAxisFromFunctionSeries(series, functionXAxis.min, functionXAxis.max),
      };
    }
  }

  const notes = text(row.notes, "", 180);
  const preserveAspectRatio = row.preserveAspectRatio === true;
  return {
    id,
    placeholder,
    type,
    title,
    ...(description ? { description } : {}),
    ...(xAxis ? { xAxis } : {}),
    ...(yAxis ? { yAxis } : {}),
    series,
    ...(notes ? { notes } : {}),
    ...(preserveAspectRatio ? { preserveAspectRatio: true } : {}),
  };
}

export function parseJsonObject(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("No JSON object found");
  }
}

export function validateGraphArtifacts(raw: unknown, placeholders: string[]): GraphArtifact[] {
  const root = asRecord(raw);
  const graphRows = Array.isArray(root?.graphs) ? root.graphs : Array.isArray(raw) ? raw : [];
  const allowed = new Set(placeholders.map((p) => p.toLowerCase()).slice(0, 3));
  const seen = new Set<string>();
  const out: GraphArtifact[] = [];
  for (const rawGraph of graphRows) {
    if (out.length >= 3) break;
    const graph = validateGraph(rawGraph, allowed, out.length);
    if (!graph || seen.has(graph.placeholder)) continue;
    if (!graphArtifactIsRenderable(graph)) {
      console.log("[graphs] dropped non-renderable graph:", graph.placeholder, graph.type);
      continue;
    }
    seen.add(graph.placeholder);
    out.push(graph);
  }
  return out;
}
