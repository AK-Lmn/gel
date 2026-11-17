// No node imports here: this file also runs in a browser. It needs `ctx.baseMoved`, the files the base branch
// changed since this pull request's branch forked from it (`gel run` collects it with git, lib/diff.mjs). Without it
// (a push scan, a browser) it passes. A branch cut before the base changed its CI, build or scoring files runs the
// old gates and fails checks the base already fixed, so the author reads logs for a problem that is not theirs.
// It reports when any watched file moved on the base. It judges paths only, never the PR title or the diff.
// gel.json can tune it: "stale_base": { "watch": [globs that matter], "ignore": [globs never asked about] }
import { matchAny } from "../../lib/glob.mjs";

export const name = "stale-base";

export const WATCH = [
  ".github/workflows/**", ".github/actions/**", "scripts/scores/**", "Makefile", "docs/gel.json",
];

export function run({ ctx, cfg }) {
  const moved = ctx?.baseMoved;
  if (!Array.isArray(moved) || !moved.length) return { pass: true, findings: [] };
  const c = cfg?.stale_base ?? {};
  const watch = c.watch ?? WATCH;
  const hit = moved.filter((f) => matchAny(watch, f) && !matchAny(c.ignore ?? [], f));
  if (!hit.length) return { pass: true, findings: [] };
  return {
    pass: false,
    findings: [{ file: hit[0], line: 1, message: `the base branch changed ${hit.length} CI or scoring file${hit.length > 1 ? "s" : ""} (${hit.slice(0, 3).join(", ")}${hit.length > 3 ? ", ..." : ""}) after this branch forked; merge or rebase the base branch, because red checks here may already be fixed there` }],
  };
}
