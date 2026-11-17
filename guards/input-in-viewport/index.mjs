// No node imports here: this file also runs in a browser. A visitor on a phone must be able to DO the thing
// without scrolling: if the page's main input or textarea is pushed below the first screen by a banner, a pitch or
// an animation, most visitors leave without ever typing. The guard reads a MEASUREMENT (layout cannot be judged from
// source), written by `gel input-viewport --url <page> --write` (headless Chrome, 375x812 by default):
//   "input_in_viewport": {
//     "result": "bench/input-viewport.json",   // {"measuredAt": "...", "entries": [{"page","width","height","top","bottom"}]}
//     "max_age_days": 30,                      // optional, default 30
//     "pages": ["index.html"]                  // optional: static pages that are expected to have an input
//   }
// It applies when gel.json has "input_in_viewport", or when index.html / public/index.html / docs/index.html / site/index.html
// contain a visible text input or textarea. Missing or stale measurement, no input found, or an input whose bottom edge
// is below the viewport height = finding. An archived repo needs none.
export const name = "input-in-viewport";

const PAGES = ["index.html", "public/index.html", "docs/index.html", "site/index.html"];
// type=hidden, checkbox, radio, submit, button, file, image, reset, range, color do not count as "the input".
const hasTextInput = (html) => {
  const body = html.replace(/<script[\s\S]*?<\/script\b[^>]*>|<style[\s\S]*?<\/style\b[^>]*>|<!--[\s\S]*?--!?>/gi, " ");
  if (/<textarea\b/i.test(body)) return true;
  for (const m of body.matchAll(/<input\b([^>]*)>/gi)) {
    const t = /\btype\s*=\s*["']?([a-z-]+)/i.exec(m[1])?.[1]?.toLowerCase() ?? "text";
    if (!["hidden", "checkbox", "radio", "submit", "button", "file", "image", "reset", "range", "color"].includes(t)) return true;
  }
  return false;
};

export function run({ cfg, files, read, ctx }) {
  if (cfg?.status === "archived") return { pass: true, findings: [] };
  const c = cfg?.input_in_viewport;
  const declared = c != null && typeof c === "object";
  const pages = (c?.pages ?? PAGES).filter((p) => (files ?? []).includes(p));
  const withInput = pages.filter((p) => { const h = read?.(p); return h != null && hasTextInput(h); });
  if (!declared && withInput.length === 0) return { pass: true, findings: [] };
  const findings = [];
  const at = (message) => findings.push({ file: "gel.json", line: 0, message: `input in viewport: ${message}` });
  const resultFile = typeof c?.result === "string" && c.result.trim() ? c.result.trim() : "bench/input-viewport.json";
  const raw = (files ?? []).includes(resultFile) ? read?.(resultFile) : null;
  if (raw == null) {
    at(`${withInput.length ? `${withInput[0]} has an input` : "this repo declares a page with an input"} but "${resultFile}" is missing: run \`gel input-viewport --url <page> --write ${resultFile}\` and commit it`);
    return { pass: false, findings };
  }
  let r;
  try { r = JSON.parse(raw); } catch { at(`${resultFile} is not valid JSON`); return { pass: false, findings }; }
  const entries = Array.isArray(r?.entries) ? r.entries : [];
  if (entries.length === 0) { at(`${resultFile} has no "entries"`); return { pass: false, findings }; }
  const now = ctx?.now ? Date.parse(ctx.now) : Date.now();
  const when = Date.parse(r.measuredAt);
  const maxAge = (c?.max_age_days ?? 30) * 86400000;
  if (Number.isNaN(when)) at(`${resultFile} has no "measuredAt" date`);
  else if (now - when > maxAge) at(`measured ${Math.floor((now - when) / 86400000)} days ago (limit ${c?.max_age_days ?? 30}): measure again`);
  for (const e of entries) {
    const label = `${e.page ?? "page"} at ${e.width}x${e.height}`;
    if (typeof e.top !== "number" || typeof e.bottom !== "number" || typeof e.height !== "number") at(`${label}: no input was found on the page (needs numeric top, bottom, height)`);
    else if (e.bottom > e.height) at(`${label}: the input ends at ${Math.round(e.bottom)}px, below the first screen (${e.height}px): a visitor must scroll before they can type; move it up or shrink what is above it`);
  }
  return { pass: findings.length === 0, findings };
}
