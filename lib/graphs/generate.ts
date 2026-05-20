import { chat, resolveModel } from "@/lib/ai/llm";
import { isVertexConfigured } from "@/lib/ai/vertex-auth";
import { extractGraphPlaceholders, type GraphArtifact } from "@/lib/graphs/types";
import { parseJsonObject, validateGraphArtifacts } from "@/lib/graphs/validation";

interface GenerateGraphArtifactsInput {
  answer: string;
  userMessage: string;
  subject: string;
  grade: string | number;
  chapter_name?: string;
  topic_name?: string;
}

function coverageCount(graphs: GraphArtifact[], placeholders: string[]): number {
  const set = new Set(graphs.map((g) => g.placeholder.toLowerCase()));
  return placeholders.filter((p) => set.has(p.toLowerCase())).length;
}

/** Prefer retry graphs per placeholder when merging (later array wins). */
function mergeGraphArtifactsByPlaceholder(a: GraphArtifact[], b: GraphArtifact[]): GraphArtifact[] {
  const map = new Map<string, GraphArtifact>();
  for (const g of a) map.set(g.placeholder.toLowerCase(), g);
  for (const g of b) map.set(g.placeholder.toLowerCase(), g);
  return [...map.values()].slice(0, 3);
}

function buildGraphPrompt(
  placeholders: string[],
  userMessage: string,
  subject: string,
  grade: string | number,
  answer: string,
  chapter_name?: string,
  topic_name?: string,
): string {
  const subjectUpper = String(subject).toUpperCase();
  const ismath = /math/i.test(subject);
  const isscience = /science|physics|chemistry|biology/i.test(subject);
  const issocial = /social|history|geography|civics|economics/i.test(subject);

  const subjectGraphHints = ismath
    ? `MATHEMATICS GRAPH RULES:
- Quadratic y=ax²+bx+c: show a domain that captures both roots and the vertex. Typical domain: [-6,6] or centred on vertex x. Add sliders for a, b, c so students can explore the parabola shape.
- Linear y=mx+c: show the line across a meaningful range; add sliders for m (slope) and c (intercept).
- Trigonometric: sin/cos — show 1–2 complete periods (xAxis ≈ -6.3 to 6.3). tan — restrict domain to ONE period between asymptotes, e.g. xAxis: -1.4 to 1.4.
- Exponential y=aˣ or y=a*exp(b*x): typically xAxis -3 to 4.
- Logarithm y=log(x) or ln(x): set xAxis min > 0 (e.g. 0.1 to 10).
- Polynomials: centre the domain around the roots. Show all turning points.
- 1/x or rational: choose a domain that avoids x=0 entirely (e.g. xAxis 0.5 to 10 for positive branch).
- Always compute the actual y range from the domain and use it — never guess ±1000.`
    : isscience
    ? `SCIENCE GRAPH RULES:
- Motion graphs (position-time, velocity-time, acceleration-time): x-axis is time ≥ 0, use units in axis label (e.g. "Time (s)", "Distance (m)", "Velocity (m/s)").
- For uniform motion: straight line (type "line"). For uniformly accelerated: parabola (type "function").
- Ohm's Law (V vs I): linear, positive quadrant only. Label: xAxis "Current (A)", yAxis "Voltage (V)".
- Hooke's Law (Force vs extension): linear, positive quadrant. Label properly.
- Cooling/heating curves: show exponential approach (type "function" with exp).
- Wave graphs: show 1–2 complete cycles; label x as "Time (s)" or "Position (m)" and y as "Displacement (m)".`
    : issocial
    ? `SOCIAL SCIENCE GRAPH RULES:
- Economic supply/demand: both curves on same graph (type "function"), positive quadrant only (price on y, quantity on x).
- Population/resource data: use bar or line chart with real NCERT figures where available.
- Historical timelines: bar chart with years as categories.`
    : "";

  // Detect if the question is about line-circle interaction and inject a specific geometry recipe
  const isLineCircle = /line.*circle|circle.*line|tangent|secant|no.?intersect|does.*line.*touch|touch.*circle/i.test(userMessage + " " + answer);
  const lineCircleHint = isLineCircle
    ? `
CIRCLE-LINE INTERACTION GEOMETRY (MANDATORY RECIPE):
The question asks about how a line interacts with a circle. You MUST output type "line" (NOT "function") with these series:
1. **Circle (use the circle primitive — never hand-write hundreds of x,y points for a circle):**
   { "id": "circle", "label": "Circle", "color": "var(--base-600)", "circle": { "cx": 0, "cy": 0, "r": 5, "segments": 96 } }
   Parametric form: x = cx + r·cos(t), y = cy + r·sin(t) is rendered exactly on the client.
2. "tangent line": 2-point segment: "points": [{ "x", "y" }, { "x", "y" }]
3. "secant line": 2-point segment through the circle (2 intersections)
4. "no intersection": 2-point segment that does not meet the circle
Use xAxis/yAxis that contains the full circle + lines with 15% padding (e.g. for r=5: -8 to 8 on both axes).
Color guide: tangent="#10B981", secant="#0F7BFF", no-intersection="#EF4444".
CRITICAL: Set "preserveAspectRatio": true so the circle is not stretched into an ellipse on screen.
For **ellipses** (not circles), use: "ellipse": { "cx", "cy", "a", "b", "segments": 96 } (x = cx + a·cos(t), y = cy + b·sin(t)). Still set preserveAspectRatio.
`
    : "";

  return `Create precise, educationally accurate interactive graph specs for a Grade ${grade} ${subjectUpper} tutor answer.
${lineCircleHint}
Return ONLY valid JSON:
{
  "graphs": [
    {
      "id": "short-id",
      "placeholder": "placeholder-id-without-brackets",
      "type": "function | line | scatter | bar | area | histogram | pie",
      "title": "NCERT concept name, e.g. Quadratic y = ax² + bx + c",
      "description": "one sentence",
      "xAxis": { "label": "x", "min": -10, "max": 10 },
      "yAxis": { "label": "y", "min": -5, "max": 20 },
      "series": [
        {
          "id": "series-1",
          "label": "y = x²",
          "expression": "pow(x, n)",
          "parameters": [
            { "id": "n", "label": "Exponent (n)", "defaultValue": 2, "min": -3, "max": 5, "step": 0.25 }
          ],
          "points": [{ "x": 0, "y": 0 }],
          "categories": [{ "label": "Category", "value": 10 }]
        }
      ],
      "notes": "optional short note",
      "preserveAspectRatio": false
    }
  ]
}

REQUIRED RULES — follow precisely:
1. Build one graph for each placeholder: ${placeholders.join(", ")}. placeholder must match exactly (no [[graph:...]] brackets).
2. EXPRESSION SYNTAX: Use only x, numbers, +, -, *, /, ^, parentheses, pi, e, and: sin/cos/tan/sqrt/log/ln/abs/exp/min/max/pow. Write explicit multiplication: 2*x not 2x, a*sin(x) not asin(x).
3. DOMAIN ACCURACY — most common source of wrong graphs:
   - Compute actual y values at key x points and set yAxis min/max to contain them + 15% padding. NEVER use ±1000 or an arbitrary large range.
   - tan(x): restrict to ONE period that avoids asymptotes, e.g. xAxis -1.4 to 1.4 (±π/2 approximately).
   - log(x) / ln(x): set xAxis min > 0 (e.g. 0.1).
   - sqrt(x): set xAxis min ≥ 0.
   - 1/x or rational functions: choose domain on ONE side of the pole (e.g. 0.2 to 10 or -10 to -0.2).
   - Time-axis graphs (motion, physics): xAxis min = 0 always.
   - Quadratic y=ax²+bx+c: centre domain ≈ vertex x ± 5 units to show roots + vertex clearly.
4. SLIDERS (parameters): Add interactive sliders whenever students need to explore how changing a number (amplitude, slope, exponent, phase shift, etc.) affects the shape. Parameter ids must be short and not reserved (no: x, e, pi, sin, cos, tan, sqrt, log, ln, abs, exp, min, max, pow). Use: a, b, c, k, n, m, p, q. Reference them in "expression".
5. COORDINATE GEOMETRY: use type "line". ALWAYS set "preserveAspectRatio": true.
   - **Circle:** use "circle": { "cx", "cy", "r", "segments": 96 } — the app draws x = cx + r·cos(t), y = cy + r·sin(t). Do NOT approximate circles with long "points" arrays (ordering errors cause broken shapes).
   - **Ellipse:** use "ellipse": { "cx", "cy", "a", "b", "segments": 96 } for x = cx + a·cos(t), y = cy + b·sin(t).
   - Segments (tangents, chords, radii): use "points" with exactly 2 vertices per segment.
   - Never use type "scatter" for constructions.
   - xAxis/yAxis must contain all geometry + padding.
6. SCATTER: datasets / point clouds only. Include ≥6 meaningful points with clear spatial spread.
7. BAR / PIE / HISTOGRAM: provide categories with correct numeric values. Use actual NCERT data where available.
8. AXIS LABELS: use standard NCERT/textbook terminology with units where applicable — "Time (s)", "Distance (m)", "Velocity (m/s)", "Current (A)", "Force (N)", "Price (₹)", "Quantity (units)".
9. TITLE: use the exact NCERT concept name from the topic, e.g. "Uniform Motion: Distance–Time", "Ohm's Law: V vs I", "Quadratic Parabola y = ax² + bx + c".
10. If a placeholder cannot be represented accurately, omit that graph.

${subjectGraphHints}

Context:
Grade: ${grade} | Subject: ${subjectUpper}${chapter_name ? ` | Chapter: ${chapter_name}` : ""}${topic_name ? ` | Topic: ${topic_name}` : ""}

Student question:
${userMessage}

Tutor answer (match each [[graph:id]] placeholder):
${answer}`;
}

const GEOMETRY_RETRY_ADDENDUM = `
REMEDIATION (previous graphs were rejected — follow exactly):
- The UI plots **polylines** (type "line") or **functions** (type "function").
- For **circles**: use the JSON field "circle": { "cx", "cy", "r", "segments": 96 } — do NOT send a huge "points" array for the circle (hand-generated points are often ordered wrong and look broken).
- For **ellipses**: use "ellipse": { "cx", "cy", "a", "b", "segments": 96 }.
- For **line segments** (tangent, chord, radius): use "points" with exactly 2 vertices per series.
- Never answer with scatter plots that only mark isolated landmarks unless you also include proper line/circle primitives above.
- Total vertices on non-primitive polylines must be enough that shapes are visibly drawn (not two isolated dots).`;

export async function generateGraphArtifactsForAnswer({
  answer,
  userMessage,
  subject,
  grade,
  chapter_name,
  topic_name,
}: GenerateGraphArtifactsInput): Promise<GraphArtifact[]> {
  const placeholders = extractGraphPlaceholders(answer).slice(0, 3);
  if (placeholders.length === 0) return [];

  const prompt = buildGraphPrompt(placeholders, userMessage, subject, grade, answer, chapter_name, topic_name);

  const systemContent =
    "You generate validated JSON graph specs for an educational chat UI. Never include markdown fences or explanations.";

  async function runModel(userContent: string): Promise<GraphArtifact[]> {
    const raw = await chat(
      [{ role: "system", content: systemContent }, { role: "user", content: userContent }],
      {
        model: resolveModel(false, true),
        temperature: 0.1,
        maxTokens: 4096,
        jsonMode: true,
        thinkingBudget: isVertexConfigured() ? 0 : undefined,
      },
    );
    return validateGraphArtifacts(parseJsonObject(raw), placeholders);
  }

  try {
    let artifacts = await runModel(prompt);

    if (coverageCount(artifacts, placeholders) < placeholders.length) {
      console.log("[graphs] retrying generation; covered", coverageCount(artifacts, placeholders), "/", placeholders.length);
      const retryPrompt = buildGraphPrompt(placeholders, userMessage, subject, grade, answer, chapter_name, topic_name);
      const retryArtifacts = await runModel(`${retryPrompt}\n${GEOMETRY_RETRY_ADDENDUM}`);
      artifacts = mergeGraphArtifactsByPlaceholder(artifacts, retryArtifacts);
    }

    return artifacts;
  } catch (error) {
    console.warn("[graphs] generation skipped:", error instanceof Error ? error.message.slice(0, 160) : String(error));
    return [];
  }
}
