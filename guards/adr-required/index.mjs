// No node imports here: this file also runs in a browser. It is opt-in: a repo lists the paths where a change is
// an architectural decision, and a pull request that touches them must add an ADR (a new .md file) that has the
// sections that make it one. Needs `changes`; on a push scan it passes. gel.json:
//   "adr_required": { "paths": ["src/runtime/**", "schemas/**"], "directory": "docs/adr", "min_lane": "A",
//                     "sections": ["context", "decision", "alternatives", "consequences"] }
// min_lane (A, B or C, default A) is the lowest risk lane (lib/lane.mjs) at which the rule applies. A repo with
// no `paths` is never asked for an ADR: not every change is a decision.
import { matchAny } from "../../lib/glob.mjs";
import { pickLane } from "../../lib/lane.mjs";

export const name = "adr-required";
export const SECTIONS = ["context", "decision", "alternatives", "consequences"];
const ORDER = ["A", "B", "C"];

export function run({ changes, cfg, read }) {
  const c = cfg?.adr_required;
  if (!changes || !c?.paths?.length) return { pass: true, findings: [] };
  const dir = String(c.directory ?? "docs/adr").replace(/\/+$/, "");
  const inDir = (f) => f.startsWith(`${dir}/`) && /\.md$/i.test(f) && !/(^|\/)(readme|template)[^/]*$/i.test(f);
  const hit = changes.map((x) => x.file).filter((f) => !f.startsWith(`${dir}/`) && matchAny(c.paths, f));
  if (!hit.length) return { pass: true, findings: [] };
  const { lane } = pickLane(changes.map((x) => x.file), cfg);
  if (ORDER.indexOf(lane) < ORDER.indexOf(ORDER.includes(c.min_lane) ? c.min_lane : "A")) return { pass: true, findings: [] };
  const added = changes.filter((x) => x.status === "A" && inDir(x.file));
  const need = (c.sections ?? SECTIONS).map((s) => String(s).toLowerCase());
  const heads = (text) => new Set((text ?? "").split("\n").map((l) => l.match(/^#{1,6}\s*(?:\d+[.)]?\s*)?([A-Za-z]+)/)?.[1]?.toLowerCase()).filter(Boolean));
  let best = null;
  for (const a of added) {
    const have = heads(read?.(a.file));
    const missing = need.filter((s) => !have.has(s));
    if (!missing.length) return { pass: true, findings: [] };
    if (!best || missing.length < best.missing.length) best = { file: a.file, missing };
  }
  const where = `${hit[0]}${hit.length > 1 ? ` and ${hit.length - 1} more` : ""}`;
  if (best) return { pass: false, findings: [{ file: best.file, line: 1, message: `ADR is missing the section${best.missing.length > 1 ? "s" : ""}: ${best.missing.join(", ")}` }] };
  return { pass: false, findings: [{ file: hit[0], line: 1, message: `${where} is an architectural path; add an ADR under ${dir}/ (sections: ${need.join(", ")})` }] };
}
