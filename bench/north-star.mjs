#!/usr/bin/env node
// North star: share of planted defects GEL catches, on 30 public repos (bench/run.mjs).
//   node bench/north-star.mjs [--work <dir>]
// Runs the bench into a temp file, then prints {"value": defects GEL caught, "baseline": defects the repos' own CI
// would catch, ...}. The baseline is generous: a repo counts as catching EVERY planted defect of a kind when its
// workflows name a tool for that kind (it only reads workflow text, so it ignores push protection and hooks).
// "Planted" includes the hard cases GEL is not built for, so the rate is not 100% by choice.
// Needs git and network on the first run (it clones the 30 repos pinned in bench/corpus.json).
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const wi = process.argv.indexOf("--work");
const work = wi >= 0 ? process.argv[wi + 1] : join(here, ".work");
const tmp = mkdtempSync(join(process.env.TMPDIR || tmpdir(), "gel-ns-"));
const out = join(tmp, "results.json");
try {
  execFileSync(process.execPath, [join(here, "run.mjs"), "--work", work, "--out", out], { stdio: ["ignore", "ignore", "inherit"] });
  const r = JSON.parse(readFileSync(out, "utf8"));
  const own = { secret: "secrets", action: "pins", perm: "perms", link: "links", claim: "claims" };
  let planted = 0, caught = 0, ownCaught = 0;
  for (const x of r.repos) for (const p of x.planted) { planted++; if (p.caught) caught++; if (x.ownCi[own[p.kind]]) ownCaught++; }
  console.log(JSON.stringify({ value: caught, baseline: ownCaught, unit: `defects caught, of ${planted} planted`, planted, repos: r.repos.length, runs: 1 }));
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
