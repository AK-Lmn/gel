#!/usr/bin/env node
// Real pull requests: how often does a PR say "all tests pass" while a check on its last commit is red?
// Runs the done-without-green guard on public PRs found by GitHub search. Needs `gh` signed in.
//   node bench/claims.mjs [--query '"all tests pass"'] [--since 2026-10-01] [--limit 100]
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadGuard } from "../lib/guards.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const QUERIES = opt("query", '"all tests pass"|"all checks pass"|"ready to merge"').split("|");
const SINCE = opt("since", "2026-10-01");
const UNTIL = opt("until", "2026-11-09"); // a week back, so checks have finished
const LIMIT = Number(opt("limit", "100"));
const gh = (path) => JSON.parse(execFileSync("gh", ["api", "-H", "Accept: application/vnd.github+json", path], { encoding: "utf8", maxBuffer: 1 << 26 }));

const guard = await loadGuard("done-without-green");
const seen = new Set();
const rows = [];
for (const q of QUERIES) {
  const search = gh(`search/issues?q=${encodeURIComponent(`${q} is:pr is:public created:${SINCE}..${UNTIL}`)}&per_page=${Math.min(LIMIT, 100)}`);
  for (const it of search.items) {
    if (rows.length >= LIMIT * QUERIES.length || seen.has(it.html_url)) continue;
    seen.add(it.html_url);
    const repo = it.repository_url.split("/repos/")[1];
    try {
      const pr = gh(`repos/${repo}/pulls/${it.number}`);
      const runs = gh(`repos/${repo}/commits/${pr.head.sha}/check-runs?per_page=100`).check_runs;
      const ctx = { claim: `${pr.title}\n${pr.body ?? ""}`, checkRuns: runs.map((r) => ({ name: r.name, conclusion: r.conclusion })) };
      const res = await guard.run({ root: ".", files: [], ctx, cfg: {} });
      const red = runs.filter((r) => ["failure", "timed_out", "cancelled", "action_required"].includes(r.conclusion)).map((r) => r.name);
      rows.push({ url: it.html_url, query: q, merged: !!pr.merged_at, checks: runs.length, red, flagged: !res.pass });
      process.stdout.write(res.pass ? "." : "X");
    } catch { process.stdout.write("?"); }
  }
}
const withChecks = rows.filter((r) => r.checks > 0);
const flagged = rows.filter((r) => r.flagged);
const summary = {
  date: new Date().toISOString().slice(0, 10), queries: QUERIES, window: `${SINCE}..${UNTIL}`,
  prs: rows.length, withChecks: withChecks.length, flagged: flagged.length,
  flaggedMerged: flagged.filter((r) => r.merged).length,
  share: withChecks.length ? flagged.length / withChecks.length : 0,
};
const out = join(here, "results.json");
const all = JSON.parse(readFileSync(out, "utf8"));
all.claims = { summary, prs: rows };
writeFileSync(out, JSON.stringify(all, null, 1) + "\n");
console.log("\n" + JSON.stringify(summary, null, 1));
for (const r of flagged) console.log(`${r.merged ? "merged " : "open   "} ${r.url}  red: ${r.red.join(", ")}`);
