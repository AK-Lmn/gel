import { percentile } from "../../lib/metrics.mjs";

export const name = "ci-reliability";
export const owner = "cilytics";
export const threshold = { min: 0.95 };

// ctx.runs: [{ workflow, sha, conclusion, ms }] from `gel eval collect --repo owner/name`.
// A run is flaky when the same workflow on the same commit both failed and passed. Score = 1 - flaky share.
export function run({ ctx }) {
  const runs = (ctx.runs ?? []).filter((r) => r.conclusion === "success" || r.conclusion === "failure");
  if (!runs.length) return { score: null, detail: "no run history (pass --runs runs.json)" };
  const groups = new Map();
  for (const r of runs) {
    const k = `${r.workflow}|${r.sha}`;
    const g = groups.get(k) ?? { pass: 0, fail: 0 };
    r.conclusion === "success" ? g.pass++ : g.fail++;
    groups.set(k, g);
  }
  const flaky = [...groups].filter(([, g]) => g.pass && g.fail).map(([k]) => k);
  const firstPass = [...groups.values()].filter((g) => !g.fail).length / groups.size;
  const ms = runs.map((r) => r.ms).filter((x) => typeof x === "number");
  const p = (n) => (percentile(ms, n) === null ? "-" : `${Math.round(percentile(ms, n) / 1000)}s`);
  return {
    score: 1 - flaky.length / groups.size,
    detail: `${groups.size} workflow-commits, ${flaky.length} flaky, first-pass ${(firstPass * 100).toFixed(0)}%, duration p50 ${p(50)} p95 ${p(95)}`,
    items: flaky.map((k) => ({ flaky: k })),
  };
}
