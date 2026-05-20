type Token =
  | { type: "number"; value: number }
  | { type: "identifier"; value: string }
  | { type: "operator"; value: "+" | "-" | "*" | "/" | "^" }
  | { type: "paren"; value: "(" | ")" }
  | { type: "comma" };

type EvalNode =
  | { kind: "number"; value: number }
  | { kind: "variable" }
  | { kind: "unary"; op: "+" | "-"; child: EvalNode }
  | { kind: "binary"; op: "+" | "-" | "*" | "/" | "^"; left: EvalNode; right: EvalNode }
  | { kind: "call"; name: string; args: EvalNode[] };

const FUNCTIONS: Record<string, (...args: number[]) => number> = {
  abs: Math.abs,
  acos: Math.acos,
  asin: Math.asin,
  atan: Math.atan,
  ceil: Math.ceil,
  cos: Math.cos,
  exp: Math.exp,
  floor: Math.floor,
  ln: Math.log,
  log: Math.log10,
  max: Math.max,
  min: Math.min,
  pow: Math.pow,
  round: Math.round,
  sin: Math.sin,
  sqrt: Math.sqrt,
  tan: Math.tan,
};

const CONSTANTS: Record<string, number> = {
  e: Math.E,
  pi: Math.PI,
};

/** Identifiers that cannot be used as graph parameters (parser / constants / functions). */
export const GRAPH_EXPRESSION_RESERVED_IDS = new Set<string>([
  "x",
  "e",
  "pi",
  ...Object.keys(FUNCTIONS),
]);

const COMPILE_CACHE_MAX = 48;
const compileCache = new Map<string, (x: number) => number>();

function compileCached(expression: string): (x: number) => number {
  const hit = compileCache.get(expression);
  if (hit) return hit;
  const fn = compileGraphExpression(expression);
  if (compileCache.size >= COMPILE_CACHE_MAX) {
    const first = compileCache.keys().next().value as string | undefined;
    if (first) compileCache.delete(first);
  }
  compileCache.set(expression, fn);
  return fn;
}

/**
 * Replace parameter identifiers with numeric literals (whole-token only).
 * Params must not collide with GRAPH_EXPRESSION_RESERVED_IDS.
 */
export function substituteGraphParameters(expression: string, params: Record<string, number>): string {
  let out = expression;
  const keys = Object.keys(params).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (GRAPH_EXPRESSION_RESERVED_IDS.has(key.toLowerCase())) continue;
    const safe = key.replace(/[^a-zA-Z0-9_]/g, "");
    if (!safe) continue;
    const re = new RegExp(`\\b${safe}\\b`, "g");
    out = out.replace(re, String(params[key]));
  }
  return out;
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      const start = i;
      i += 1;
      while (i < input.length && /[0-9._]/.test(input[i])) i += 1;
      if (/[eE]/.test(input[i] ?? "")) {
        i += 1;
        if (/[+-]/.test(input[i] ?? "")) i += 1;
        while (i < input.length && /[0-9_]/.test(input[i])) i += 1;
      }
      const raw = input.slice(start, i).replace(/_/g, "");
      const value = Number(raw);
      if (!Number.isFinite(value)) throw new Error(`Invalid number "${raw}"`);
      tokens.push({ type: "number", value });
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      const start = i;
      i += 1;
      while (i < input.length && /[A-Za-z0-9_]/.test(input[i])) i += 1;
      tokens.push({ type: "identifier", value: input.slice(start, i).toLowerCase() });
      continue;
    }
    if (ch === "(" || ch === ")") {
      tokens.push({ type: "paren", value: ch });
      i += 1;
      continue;
    }
    if (ch === ",") {
      tokens.push({ type: "comma" });
      i += 1;
      continue;
    }
    if (ch === "+" || ch === "-" || ch === "*" || ch === "/" || ch === "^") {
      tokens.push({ type: "operator", value: ch });
      i += 1;
      continue;
    }
    throw new Error(`Unsupported character "${ch}"`);
  }
  return tokens;
}

class Parser {
  private index = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(): EvalNode {
    const node = this.parseAdditive();
    if (this.peek()) throw new Error("Unexpected trailing expression");
    return node;
  }

  private peek(): Token | undefined {
    return this.tokens[this.index];
  }

  private take(): Token | undefined {
    const token = this.tokens[this.index];
    this.index += 1;
    return token;
  }

  private parseAdditive(): EvalNode {
    let node = this.parseMultiplicative();
    while (true) {
      const next = this.peek();
      if (next?.type !== "operator" || (next.value !== "+" && next.value !== "-")) break;
      const op = next.value;
      this.take();
      node = { kind: "binary", op, left: node, right: this.parseMultiplicative() };
    }
    return node;
  }

  private parseMultiplicative(): EvalNode {
    let node = this.parsePower();
    while (true) {
      const next = this.peek();
      if (next?.type !== "operator" || (next.value !== "*" && next.value !== "/")) break;
      const op = next.value;
      this.take();
      node = { kind: "binary", op, left: node, right: this.parsePower() };
    }
    return node;
  }

  private parsePower(): EvalNode {
    const node = this.parseUnary();
    const next = this.peek();
    if (next?.type === "operator" && next.value === "^") {
      this.take();
      return { kind: "binary", op: "^", left: node, right: this.parsePower() };
    }
    return node;
  }

  private parseUnary(): EvalNode {
    const next = this.peek();
    if (next?.type === "operator" && (next.value === "+" || next.value === "-")) {
      const op = next.value;
      this.take();
      return { kind: "unary", op, child: this.parseUnary() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): EvalNode {
    const token = this.take();
    if (!token) throw new Error("Unexpected end of expression");
    if (token.type === "number") return { kind: "number", value: token.value };
    if (token.type === "identifier") {
      const next = this.peek();
      if (next?.type === "paren" && next.value === "(") {
        this.take();
        const args: EvalNode[] = [];
        const maybeClose = this.peek();
        if (!(maybeClose?.type === "paren" && maybeClose.value === ")")) {
          while (true) {
            args.push(this.parseAdditive());
            if (this.peek()?.type !== "comma") break;
            this.take();
          }
        }
        const close = this.take();
        if (close?.type !== "paren" || close.value !== ")") throw new Error("Missing closing parenthesis");
        if (!FUNCTIONS[token.value]) throw new Error(`Unsupported function "${token.value}"`);
        return { kind: "call", name: token.value, args };
      }
      if (token.value === "x") return { kind: "variable" };
      if (CONSTANTS[token.value] != null) return { kind: "number", value: CONSTANTS[token.value] };
      throw new Error(`Unsupported identifier "${token.value}"`);
    }
    if (token.type === "paren" && token.value === "(") {
      const node = this.parseAdditive();
      const close = this.take();
      if (close?.type !== "paren" || close.value !== ")") throw new Error("Missing closing parenthesis");
      return node;
    }
    throw new Error("Expected a number, variable, function, or parenthesized expression");
  }
}

function evaluate(node: EvalNode, x: number): number {
  switch (node.kind) {
    case "number":
      return node.value;
    case "variable":
      return x;
    case "unary": {
      const value = evaluate(node.child, x);
      return node.op === "-" ? -value : value;
    }
    case "binary": {
      const left = evaluate(node.left, x);
      const right = evaluate(node.right, x);
      if (node.op === "+") return left + right;
      if (node.op === "-") return left - right;
      if (node.op === "*") return left * right;
      if (node.op === "/") return left / right;
      return Math.pow(left, right);
    }
    case "call": {
      const fn = FUNCTIONS[node.name];
      const args = node.args.map((arg) => evaluate(arg, x));
      return fn(...args);
    }
  }
}

export function compileGraphExpression(expression: string): (x: number) => number {
  if (expression.length > 160) throw new Error("Expression is too long");
  const node = new Parser(tokenize(expression)).parse();
  return (x: number) => {
    const value = evaluate(node, x);
    return Number.isFinite(value) ? value : Number.NaN;
  };
}

export function sampleExpression(expression: string, min: number, max: number, samples = 180): { x: number; y: number }[] {
  const fn = compileCached(expression);
  const count = Math.max(16, Math.min(400, Math.floor(samples)));
  const span = max - min;

  // First pass: collect raw samples
  const raw: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= count; i += 1) {
    const x = min + (span * i) / count;
    raw.push({ x, y: fn(x) });
  }

  // Compute jump detection threshold from the middle 90% of finite values.
  // A jump larger than 4× this range between adjacent points signals a vertical asymptote.
  const finiteYs = raw.filter((p) => Number.isFinite(p.y)).map((p) => p.y);
  finiteYs.sort((a, b) => a - b);
  const jumpThreshold =
    finiteYs.length >= 4
      ? Math.max(
          (finiteYs[Math.floor(finiteYs.length * 0.95)] - finiteYs[Math.floor(finiteYs.length * 0.05)]) * 4,
          1e-6,
        )
      : Infinity; // too few finite points → skip jump detection to avoid false gaps

  // Second pass: output with NaN gap markers at discontinuities.
  // Callers that draw paths (makePath) will break the line at these gaps.
  const out: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < raw.length; i += 1) {
    const curr = raw[i];

    if (!Number.isFinite(curr.y)) {
      // Insert a single gap marker if the previous output point was valid
      if (out.length > 0 && Number.isFinite(out[out.length - 1].y)) {
        out.push({ x: curr.x, y: NaN });
      }
      continue;
    }

    // Detect asymptote: large jump between consecutive finite values
    if (out.length > 0 && Number.isFinite(out[out.length - 1].y)) {
      if (Math.abs(curr.y - out[out.length - 1].y) > jumpThreshold) {
        const prevX = raw[Math.max(0, i - 1)].x;
        out.push({ x: (prevX + curr.x) / 2, y: NaN });
      }
    }

    out.push({ x: curr.x, y: curr.y });
  }
  return out;
}
