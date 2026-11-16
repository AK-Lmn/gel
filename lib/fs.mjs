import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SKIP = new Set([".git", "node_modules", ".gel-engine", "dist", "vendor", ".next"]);
export function walk(root, dir = root, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(root, p, out);
    else if (st.size < 2_000_000) out.push(relative(root, p).split("\\").join("/"));
  }
  return out;
}
export function readText(root, file) {
  const buf = readFileSync(join(root, file));
  if (buf.includes(0)) return null; // binary
  return buf.toString("utf8");
}
