#!/usr/bin/env node
// Meta-eval ratchet: the bench must not get worse than bench/baseline.json.
//   node bench/check.mjs [--results bench/results.json] [--write]
// Fails when a guard catches fewer planted defects it claims to cover, or raises more findings on the clean repos.
// --write sets the baseline from the current results; that is a lane C change a person approves.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const basePath = join(here, "baseline.json");

export function snapshot(s) {
  return {
    caught: Object.fromEntries(Object.entries(s.perKind).map(([k, v]) => [k, { caught: v.covered.caught, n: v.covered.n }])),
    clean: Object.fromEntries(Object.entries(s.clean).map(([g, v]) => [g, v.findings])),
  };
}

export function compare(base, now) {
  const worse = [];
  for (const [k, b] of Object.entries(base.caught)) {
    const n = now.caught[k];
    if (!n) { worse.push(`${k}: missing from results`); continue; }
    if (n.caught / n.n < b.caught / b.n) worse.push(`${k}: caught ${n.caught}/${n.n}, baseline ${b.caught}/${b.n}`);
  }
  for (const [g, b] of Object.entries(base.clean)) {
    if ((now.clean[g] ?? 0) > b) worse.push(`${g}: ${now.clean[g]} findings on clean repos, baseline ${b}`);
  }
  return worse;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const results = JSON.parse(readFileSync(opt("results", join(here, "results.json")), "utf8")).summary;
  const now = snapshot(results);
  if (args.includes("--write") || !existsSync(basePath)) {
    writeFileSync(basePath, JSON.stringify({ date: results.date, ...now }, null, 1) + "\n");
    console.log(`baseline written: ${basePath}`);
    process.exit(0);
  }
  const worse = compare(JSON.parse(readFileSync(basePath, "utf8")), now);
  const lines = ["## GEL meta-eval", "", worse.length ? `**Worse than the baseline:**\n${worse.map((w) => `- ${w}`).join("\n")}` : "Not worse than the baseline on any planted kind or clean-repo count."];
  for (const [k, v] of Object.entries(now.caught)) lines.push(`- ${k}: ${v.caught}/${v.n} planted caught`);
  for (const [g, v] of Object.entries(now.clean)) lines.push(`- ${g}: ${v} findings on clean repos`);
  console.log(lines.join("\n"));
  if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n", { flag: "a" });
  process.exit(worse.length ? 1 : 0);
}
