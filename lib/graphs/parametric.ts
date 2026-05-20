import type { GraphCirclePrimitive, GraphEllipsePrimitive, GraphPoint } from "@/lib/graphs/types";

function clampSegments(n: number | undefined): number {
  if (n == null || !Number.isFinite(n)) return 96;
  return Math.max(32, Math.min(256, Math.floor(n)));
}

/** x = cx + r·cos(t), y = cy + r·sin(t), t ∈ [0, 2π], closed (first = last). */
export function sampleCirclePoints(c: GraphCirclePrimitive): GraphPoint[] {
  const n = clampSegments(c.segments);
  const pts: GraphPoint[] = [];
  for (let i = 0; i <= n; i += 1) {
    const t = (i / n) * 2 * Math.PI;
    pts.push({ x: c.cx + c.r * Math.cos(t), y: c.cy + c.r * Math.sin(t) });
  }
  return pts;
}

/** x = cx + a·cos(t), y = cy + b·sin(t). */
export function sampleEllipsePoints(e: GraphEllipsePrimitive): GraphPoint[] {
  const n = clampSegments(e.segments);
  const pts: GraphPoint[] = [];
  for (let i = 0; i <= n; i += 1) {
    const t = (i / n) * 2 * Math.PI;
    pts.push({ x: e.cx + e.a * Math.cos(t), y: e.cy + e.b * Math.sin(t) });
  }
  return pts;
}
