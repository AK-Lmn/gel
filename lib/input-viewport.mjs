// `gel input-viewport`: open a page in headless Chrome at a phone size and report where its first visible text
// input or textarea sits. The page is fetched (or read), a measuring script is added, and the copy is loaded from
// disk, so the site's own Content-Security-Policy header does not block the measurement.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SELECTOR = 'textarea,input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button]):not([type=file]):not([type=image]):not([type=reset]):not([type=range]):not([type=color]),[contenteditable=""],[contenteditable=true],[role=textbox]';
const SCRIPT = `<script>addEventListener("load",function(){setTimeout(function(){var out={width:innerWidth,height:innerHeight,top:null,bottom:null};
var els=document.querySelectorAll(${JSON.stringify(SELECTOR)});
for(var i=0;i<els.length;i++){var e=els[i],r=e.getBoundingClientRect(),s=getComputedStyle(e);
if(r.width>0&&r.height>0&&s.visibility!=="hidden"&&s.display!=="none"&&s.opacity!=="0"){out.top=r.top+scrollY;out.bottom=r.bottom+scrollY;out.tag=e.tagName.toLowerCase();break}}
var p=document.createElement("pre");p.id="gel-input-viewport";p.textContent=JSON.stringify(out);document.body.appendChild(p)},400)});</script>`;

export function findChrome() {
  const c = [process.env.CHROME, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"].filter(Boolean);
  return c.find((p) => existsSync(p)) ?? null;
}

// Pure: put the measuring script and a <base> into a page's HTML.
export function instrument(html, baseUrl) {
  const base = baseUrl ? `<base href="${baseUrl}">` : "";
  const withBase = /<head\b[^>]*>/i.test(html) ? html.replace(/<head\b[^>]*>/i, (m) => m + base) : base + html;
  return /<\/body>/i.test(withBase) ? withBase.replace(/<\/body>/i, SCRIPT + "</body>") : withBase + SCRIPT;
}
export function parseDump(dom) {
  const m = /<pre id="gel-input-viewport">([\s\S]*?)<\/pre>/.exec(dom);
  if (!m) return null;
  try { return JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&")); } catch { return null; }
}

export async function measure({ url, file, width = 375, height = 812, cookie }) {
  const chrome = findChrome();
  if (!chrome) throw new Error("Chrome not found: set CHROME=/path/to/chrome");
  const html = url ? await (await fetch(url, cookie ? { headers: { cookie } } : undefined)).text() : readFileSync(resolve(file), "utf8");
  const dir = mkdtempSync(join(tmpdir(), "gel-ivp-"));
  const page = join(dir, "page.html");
  writeFileSync(page, instrument(html, url ?? pathToFileURL(resolve(file)).href));
  const dom = execFileSync(chrome, ["--headless=new", "--disable-gpu", "--no-sandbox", `--window-size=${width},${height}`, "--virtual-time-budget=5000", "--dump-dom", pathToFileURL(page).href], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 60000, maxBuffer: 1 << 26 });
  const r = parseDump(dom);
  if (!r) throw new Error("the page did not finish loading in Chrome");
  // innerHeight in headless is the window height minus browser chrome on some builds; judge against the real viewport we asked for.
  return { page: url ?? file, ...(cookie ? { cookie } : {}), width, height, top: r.top, bottom: r.bottom, tag: r.tag ?? null };
}
