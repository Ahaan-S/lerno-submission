export const GRAPH_PLACEHOLDER_PATTERN = /\[\[graph:([a-z0-9][a-z0-9_-]{0,63})\]\]/gi;

export type GraphKind =
  | "function"
  | "line"
  | "scatter"
  | "bar"
  | "area"
  | "histogram"
  | "pie";

export interface GraphAxis {
  label?: string;
  min?: number;
  max?: number;
}

export interface GraphPoint {
  x: number;
  y: number;
  label?: string;
}

export interface GraphCategoryValue {
  label: string;
  value: number;
}

/** Tunable numeric in a function expression (replaced before parsing). Use ids like n, a, b — not x, e, pi, or math function names. */
export interface GraphSeriesParameter {
  id: string;
  label: string;
  defaultValue: number;
  min?: number;
  max?: number;
  step?: number;
}

/** Parametric circle: x = cx + r·cos(t), y = cy + r·sin(t). Rendered in the client — do not send noisy point lists. */
export interface GraphCirclePrimitive {
  cx: number;
  cy: number;
  r: number;
  /** Optional vertex count (32–256). Default 96. */
  segments?: number;
}

/** Parametric ellipse: x = cx + a·cos(t), y = cy + b·sin(t). */
export interface GraphEllipsePrimitive {
  cx: number;
  cy: number;
  a: number;
  b: number;
  segments?: number;
}

export interface GraphSeries {
  id: string;
  label: string;
  color?: string;
  expression?: string;
  /** When set, sliders adjust these identifiers in `expression` (e.g. pow(x,n) with n). */
  parameters?: GraphSeriesParameter[];
  points?: GraphPoint[];
  categories?: GraphCategoryValue[];
  /**
   * For type "line": perfect circle (parametric). Preferred over raw `points` for circles.
   * If set, `points` for this series is ignored for drawing.
   */
  circle?: GraphCirclePrimitive;
  /** For type "line": axis-aligned ellipse. If set, `points` is ignored for drawing. */
  ellipse?: GraphEllipsePrimitive;
}

export interface GraphArtifact {
  id: string;
  placeholder: string;
  type: GraphKind;
  title: string;
  description?: string;
  xAxis?: GraphAxis;
  yAxis?: GraphAxis;
  series: GraphSeries[];
  notes?: string;
  /**
   * When true, the renderer enforces equal pixel-per-unit scale on both axes
   * so geometric shapes (circles, triangles) appear undistorted.
   * Set this for any coordinate geometry graph.
   */
  preserveAspectRatio?: boolean;
}

export function extractGraphPlaceholders(content: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  GRAPH_PLACEHOLDER_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = GRAPH_PLACEHOLDER_PATTERN.exec(content)) !== null) {
    const key = match[1].toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(key);
    }
  }
  return out;
}

export function graphPlaceholderToken(placeholder: string): string {
  return `[[graph:${placeholder}]]`;
}
