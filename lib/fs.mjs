import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { execFileSync } from "node:child_process";

const SKIP = new Set([".git", "node_modules", ".gel-engine", "dist", "vendor", ".next", ".claude", ".venv"]);
export const isTestPath = (f) => /(^|\/)(tests?|__tests__|fixtures?|__fixtures__|testdata)(\/|$)|\.(test|spec)\.[a-z]+$/.test(f);
const isFile = (p) => { try { const st = statSync(p); return st.isFile() && st.size < 2_000_000; } catch { return false; } };
export function walk(root, dir = root, out = []) {
  if (dir === root) { // in a git checkout only tracked files count, the same as in CI
    try {
      const l = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8", maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "ignore"] }).split("\0").filter(Boolean);
      return l.filter((f) => !f.split("/").some((p) => SKIP.has(p)) && isFile(join(root, f)));
    } catch { /* not a git checkout: walk the folder */ }
  }
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
  let buf;
  try { buf = readFileSync(join(root, file)); } catch { return null; } // a broken symlink or folder must not crash CI
  if (buf.includes(0)) return null; // binary
  return buf.toString("utf8");
}
