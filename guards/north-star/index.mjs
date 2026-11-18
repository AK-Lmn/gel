// No node imports here: this file also runs in a browser. A repo that opts in names ONE north star metric in docs/gel.json and
// the guard FAILS when the measured result does not meet the target. A claim is not enough:
//   "north_star": {
//     "metric": "first start to healthy on a 10-part shop",
//     "baseline": "Docker Compose 5.1.3",
//     "target": { "ratio": 8, "better": "lower" },      // baseline / value must be >= 8 (use "higher" for value / baseline)
//     "result": "bench/north-star.json",                // {"value": 3.1, "baseline": 26.1, "unit": "s", "measuredAt": "...", "run": "https://..."}
//     "evidence": "bench/README.md",                    // how it is measured: a repo file or an https link
//     "measure": "node bench/north-star.mjs",           // optional: `gel north-star --measure` runs it and writes `result`
//     "max_age_days": 30                                // optional, default 30: an old number does not count
//   }
// An archived repo needs none. Missing result, stale result, or ratio under target = finding (a failure in block mode).
export const name = "north-star";

const words = (s) => (String(s).match(/\S+/g) ?? []).length;
const num = (x) => typeof x === "number" && Number.isFinite(x) && x > 0;

// ratio > 1 means "better than the baseline". lower: baseline / value (time, memory). higher: value / baseline (throughput).
export function ratioOf(result, better) {
  return better === "higher" ? result.value / result.baseline : result.baseline / result.value;
}

export function run({ cfg, files, read, ctx }) {
  if (cfg?.status === "archived") return { pass: true, findings: [] };
  // docs/gel.json is optional: a repo that has none has named no north star, so there is nothing to hold it to.
  if (cfg?.noConfigFile) return { pass: true, findings: [] };
  const findings = [];
  const at = (message) => findings.push({ file: "docs/gel.json", line: 0, message });
  const ns = cfg?.north_star;
  if (ns == null || typeof ns !== "object") {
    at(`docs/gel.json has no "north_star" (a measured metric: {"metric","baseline","target":{"ratio":8,"better":"lower"},"result":"bench/north-star.json","evidence"})`);
    return { pass: false, findings };
  }
  if (typeof ns.metric !== "string" || words(ns.metric) < 3) at(`north_star.metric must say what is measured, in at least three words`);
  if (typeof ns.baseline !== "string" || words(ns.baseline) < 1) at(`north_star.baseline must say what the target is compared with`);
  const t = ns.target;
  const better = t?.better;
  if (!t || typeof t !== "object" || !(t.ratio > 1) || (better !== "lower" && better !== "higher")) at(`north_star.target must be {"ratio": <number above 1>, "better": "lower" or "higher"}`);
  const ev = ns.evidence;
  if (typeof ev !== "string" || !ev.trim()) at(`north_star.evidence must be a file in this repo or an https link that shows how it is measured`);
  else if (!/^https:\/\/\S+$/.test(ev.trim()) && !(files ?? []).includes(ev.trim().replace(/^\.\//, "").replace(/#.*$/, ""))) at(`north_star.evidence "${ev}" is not a file in this repo and not an https link`);
  if (typeof ns.result !== "string" || !ns.result.trim()) { at(`north_star.result must name the file the measurement is written to (JSON with value and baseline)`); return { pass: false, findings }; }
  const raw = (files ?? []).includes(ns.result) ? read?.(ns.result) : null;
  if (raw == null) { at(`north_star.result "${ns.result}" is not in the repo: run \`gel north-star --measure\` and commit it (or publish it from the bench workflow)`); return { pass: false, findings }; }
  let r;
  try { r = JSON.parse(raw); } catch { at(`${ns.result} is not valid JSON`); return { pass: false, findings }; }
  if (!num(r?.value) || !num(r?.baseline)) { at(`${ns.result} needs a positive number "value" (this repo) and "baseline" (what it is compared with)`); return { pass: false, findings }; }
  const now = ctx?.now ? Date.parse(ctx.now) : Date.now();
  const at0 = Date.parse(r.measuredAt);
  const maxAge = (ns.max_age_days ?? 30) * 86400000;
  if (Number.isNaN(at0)) at(`${ns.result} has no "measuredAt" date`);
  else if (now - at0 > maxAge) at(`the north star was measured ${Math.floor((now - at0) / 86400000)} days ago (limit ${ns.max_age_days ?? 30}): measure it again`);
  if (t && t.ratio > 1 && (better === "lower" || better === "higher")) {
    const got = ratioOf(r, better);
    if (got < t.ratio) at(`north star NOT MET: ${ns.metric} is ${got.toFixed(2)}x ${better === "lower" ? "faster/lower" : "higher"} than ${ns.baseline} (value ${r.value}${r.unit ? " " + r.unit : ""} vs ${r.baseline}), target ${t.ratio}x`);
  }
  return { pass: findings.length === 0, findings };
}
