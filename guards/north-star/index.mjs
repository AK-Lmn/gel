// No node imports here: this file also runs in a browser. Every repo names ONE north star metric in gel.json:
//   "north_star": { "metric": "first start to healthy on a 10-part shop",
//                   "target": "8x faster than Docker Compose",
//                   "baseline": "Docker Compose 5.1.3",
//                   "evidence": "bench/README.md" }
// The metric says what is measured, the target is a number (a ratio, a time, a count), the baseline says what
// it is compared with, and the evidence is a file in the repo or an https link a stranger can open. An archived
// repo needs none. A claim with no number or no evidence is a slogan, not a metric.
export const name = "north-star";

const words = (s) => (String(s).match(/\S+/g) ?? []).length;

export function run({ cfg, files }) {
  if (cfg?.status === "archived") return { pass: true, findings: [] };
  const findings = [];
  const at = (message) => findings.push({ file: "gel.json", line: 0, message });
  const ns = cfg?.north_star;
  if (ns == null || typeof ns !== "object") {
    at(`gel.json has no "north_star" (one measurable metric, such as {"metric": "...", "target": "8x faster than Docker Compose", "baseline": "...", "evidence": "bench/README.md"})`);
    return { pass: false, findings };
  }
  if (typeof ns.metric !== "string" || words(ns.metric) < 3) at(`north_star.metric must say what is measured, in at least three words`);
  if (typeof ns.target !== "string" || !/\d/.test(ns.target)) at(`north_star.target must contain a number (for example "8x faster than Docker Compose" or "p95 under 200 ms")`);
  if (typeof ns.baseline !== "string" || words(ns.baseline) < 1) at(`north_star.baseline must say what the target is compared with`);
  const ev = ns.evidence;
  if (typeof ev !== "string" || !ev.trim()) at(`north_star.evidence must be a file in this repo or an https link that shows the number`);
  else if (!/^https:\/\/\S+$/.test(ev.trim()) && !(files ?? []).includes(ev.trim().replace(/^\.\//, "").replace(/#.*$/, ""))) at(`north_star.evidence "${ev}" is not a file in this repo and not an https link`);
  return { pass: findings.length === 0, findings };
}
