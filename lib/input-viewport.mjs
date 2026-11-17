// `gel input-viewport`: open a page in headless Chrome at a phone size and report where its first visible text
// input or textarea sits. The page is fetched (or read), a measuring script is added, and the copy is loaded from
// disk, so the site's own Content-Security-Policy header does not block the measurement.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SELECTOR = 'textarea,input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button]):not([type=file]):not([type=image]):not([type=reset]):not([type=range]):not([type=color]),[contenteditable=""],[contenteditable=true],[role=textbox]';
// Headless Chrome will not open a window narrower than 500px, so the page is drawn inside an iframe of exactly the
// requested size: its media queries and layout see a real 375px (or 320px) viewport. Measuring runs in the wrapper.
const MEASURE = `addEventListener("load",function(){var f=document.getElementById("f");setTimeout(function(){var d=f.contentDocument,w=f.contentWindow,out={width:w.innerWidth,height:w.innerHeight,top:null,bottom:null};
var els=d.querySelectorAll(${JSON.stringify(SELECTOR)});
for(var i=0;i<els.length;i++){var e=els[i],r=e.getBoundingClientRect(),s=w.getComputedStyle(e);
if(r.width>0&&r.height>0&&s.visibility!=="hidden"&&s.display!=="none"&&s.opacity!=="0"){out.top=r.top+w.scrollY;out.bottom=r.bottom+w.scrollY;out.tag=e.tagName.toLowerCase();break}}
var p=document.createElement("pre");p.id="gel-input-viewport";p.textContent=JSON.stringify(out);document.body.appendChild(p)},1500)});`;

export function findChrome() {
  const c = [process.env.CHROME, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"].filter(Boolean);
  return c.find((p) => existsSync(p)) ?? null;
}

// Pure: wrap a page's HTML in a frame of the given size, with a <base> so relative links still resolve.
export function instrument(html, baseUrl, width = 375, height = 667) {
  const base = baseUrl ? `<base href="${baseUrl}">` : "";
  const doc = /<head\b[^>]*>/i.test(html) ? html.replace(/<head\b[^>]*>/i, (m) => m + base) : base + html;
  const attr = doc.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  return `<!doctype html><html><body style="margin:0"><iframe id="f" width="${width}" height="${height}" style="border:0;display:block" srcdoc="${attr}"></iframe><script>${MEASURE}</script></body></html>`;
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
  writeFileSync(page, instrument(html, url ?? pathToFileURL(resolve(file)).href, width, height));
  let dom = "";
  // A private profile per run, so several measurements can run at once. Chrome sometimes keeps running after it printed the page: the output is still good.
  try { dom = execFileSync(chrome, ["--headless=new", "--disable-gpu", "--no-sandbox", `--user-data-dir=${join(dir, "profile")}`, `--window-size=${Math.max(width, 500) + 40},${height + 100}`, "--virtual-time-budget=8000", "--dump-dom", pathToFileURL(page).href], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 45000, killSignal: "SIGKILL", maxBuffer: 1 << 26 }); }
  catch (e) { dom = String(e.stdout ?? ""); }
  const r = parseDump(dom);
  if (!r) throw new Error("the page did not finish loading in Chrome");
  return { page: url ?? file, ...(cookie ? { cookie } : {}), width: r.width, height: r.height, top: r.top, bottom: r.bottom, tag: r.tag ?? null };
}
