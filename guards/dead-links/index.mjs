import { existsSync, realpathSync } from "node:fs";
import { dirname, join, normalize, relative } from "node:path";
import { readText, isTestPath } from "../../lib/fs.mjs";

export const name = "dead-links";
// Offline and fast: only links to files inside the repo. Web links need the network and are not a guard.
const MD = /\[[^\]\n]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\)/g;
const DOMAIN = /^(?:www\.)?[a-z0-9-]+\.(?:com|org|net|io|dev|sh|ai|co|app|me)\//i;
const HTML = /\b(?:href|src)=["']([^"']+)["']/g;

export function run({ root, files }) {
  const findings = [];
  for (const f of files.filter((x) => /\.(md|mdx|html?)$/.test(x))) {
    if (isTestPath(f) || /(^|\/)(templates?|_site|build|out)\//.test(f) || /(^|\/)assets\/.*\.html?$/.test(f)) continue; // generated or vendored pages // templates are copied elsewhere, their links resolve there
    const text = readText(root, f);
    if (text === null) continue;
    const isMd = /\.mdx?$/.test(f);
    let dir = dirname(f); // a symlinked README resolves its links from where it really lives
    try { dir = relative(realpathSync(root), dirname(realpathSync(join(root, f)))) || "."; } catch { /* keep the link's own folder */ }
    const stripped = isMd ? text.replace(/```[\s\S]*?```/g, (b) => b.replace(/[^\n]/g, " ")) : text;
    const re = isMd ? MD : HTML;
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(stripped))) {
      let target = m[1];
      if (/^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(target)) continue; // web, mailto, anchor, and /site-root paths that only a server can resolve
      if (/[${}<>]/.test(m[1]) || !/[./]/.test(m[1])) continue; // placeholder like URL or ${x}, not a path
      if (/:\/\/|^[(@]|^\.+$/.test(target) || DOMAIN.test(target)) continue; // a web address without its scheme, or "..."
      target = target.split("#")[0].split("?")[0];
      try { target = decodeURIComponent(target); } catch { /* keep it as written */ }
      if (!target || target.endsWith("/")) continue; // a folder link is a site route; folders on GitHub are rarely linked this way
      const base = join(root, dir, target);
      if (!normalize(base).startsWith(normalize(root))) continue;
      // Doc sites (VitePress, Docusaurus) drop the .md; Vite serves index.html assets from public/.
      const tries = [base, `${base}.md`, `${base}.mdx`, `${base}.html`, join(base, "index.md"), join(base, "README.md"), join(root, dir, "public", target)];
      if (!tries.some((p) => existsSync(p))) {
        const line = stripped.slice(0, m.index).split("\n").length;
        findings.push({ file: f, line, message: `link to ${m[1]} does not exist` });
      }
    }
  }
  return { pass: findings.length === 0, findings };
}
