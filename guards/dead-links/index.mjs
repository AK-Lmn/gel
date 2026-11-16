import { existsSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { readText } from "../../lib/fs.mjs";

export const name = "dead-links";
// Offline and fast: only links to files inside the repo. Web links need the network and are not a guard.
const MD = /\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\)/g;
const HTML = /\b(?:href|src)=["']([^"']+)["']/g;

export function run({ root, files }) {
  const findings = [];
  for (const f of files.filter((x) => /\.(md|mdx|html?)$/.test(x))) {
    const text = readText(root, f);
    if (text === null) continue;
    const isMd = /\.mdx?$/.test(f);
    const stripped = isMd ? text.replace(/```[\s\S]*?```/g, (b) => b.replace(/[^\n]/g, " ")) : text;
    const re = isMd ? MD : HTML;
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(stripped))) {
      let target = m[1];
      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(target)) continue; // web, mailto, anchor
      target = target.split("#")[0].split("?")[0];
      if (!target) continue;
      const path = target.startsWith("/") ? join(root, target) : join(root, dirname(f), target);
      if (!normalize(path).startsWith(normalize(root))) continue;
      if (!existsSync(path)) {
        const line = stripped.slice(0, m.index).split("\n").length;
        findings.push({ file: f, line, message: `link to ${m[1]} does not exist` });
      }
    }
  }
  return { pass: findings.length === 0, findings };
}
