import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const serverDir = path.join(root, ".next", "server");
const staticDir = path.join(root, ".next", "static");

if (!existsSync(serverDir) || !existsSync(staticDir)) {
  console.error("Missing .next/server or .next/static. Run `next build` first.");
  process.exit(1);
}

const sourceExtensions = new Set([".html", ".rsc"]);
const staticRefPattern = /["'`](\/_next\/static\/[^"'`<>\s\\]+)["'`]/g;
const missing = new Map();

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      walk(fullPath, files);
    } else if (sourceExtensions.has(path.extname(entry))) {
      files.push(fullPath);
    }
  }
  return files;
}

for (const file of walk(serverDir)) {
  const contents = readFileSync(file, "utf8");
  for (const match of contents.matchAll(staticRefPattern)) {
    const ref = decodeURIComponent(match[1]);
    const assetPath = path.join(root, ref.replace(/^\/_next\/static\//, ".next/static/"));
    if (!existsSync(assetPath)) {
      const relativeFile = path.relative(root, file);
      if (!missing.has(ref)) missing.set(ref, new Set());
      missing.get(ref).add(relativeFile);
    }
  }
}

if (missing.size > 0) {
  console.error("Build references missing Next static assets:");
  for (const [ref, files] of missing) {
    console.error(`- ${ref}`);
    for (const file of files) console.error(`  referenced by ${file}`);
  }
  process.exit(1);
}

console.log("Verified Next static asset references.");
