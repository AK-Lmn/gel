import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { collectRelease } from "../lib/release-ctx.mjs";

test("release-integrity imports nothing from node", () => {
  const src = readFileSync(new URL("../guards/release-integrity/index.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(src, /\bfrom\s+["']node:/);
});

const fake = (over = {}) => (p) => {
  const t = {
    "repos/o/n/git/ref/tags/v1.0.0": { object: { type: "tag", sha: "t1" } },
    "repos/o/n/git/tags/t1": { object: { sha: "c1" } },
    "repos/o/n/commits/c1": { sha: "c1" },
    "repos/o/n": { default_branch: "main" },
    "repos/o/n/compare/main...c1": { status: "behind" },
    "repos/o/n/commits/c1/check-runs?per_page=100": { check_runs: [{ name: "build", status: "completed", conclusion: "success" }] },
    "repos/o/n/actions/runs?head_sha=c1&per_page=100": { workflow_runs: [{ name: "Release", status: "completed", conclusion: "failure" }] },
    "repos/o/n/releases/tags/v1.0.0": { assets: [{ name: "a.tgz" }, { name: "SHA256SUMS" }] },
    ...over,
  };
  if (!(p in t)) throw new Error(`404 ${p}`);
  return t[p];
};

test("collector resolves an annotated tag and gathers everything", () => {
  const { release: r } = collectRelease({ repo: "o/n", tag: "v1.0.0", gh: fake() });
  assert.equal(r.sha, "c1");
  assert.equal(r.commitExists, true);
  assert.equal(r.onDefaultBranch, true);
  assert.equal(r.checks[0].name, "build");
  assert.equal(r.workflowRuns[0].conclusion, "failure");
  assert.deepEqual(r.assets, [{ name: "a.tgz" }, { name: "SHA256SUMS" }]);
});

test("collector pre phase leaves assets null", () => {
  assert.equal(collectRelease({ repo: "o/n", tag: "v1.0.0", phase: "pre", gh: fake() }).release.assets, null);
});

test("collector: a diverged commit is off the default branch", () => {
  const r = collectRelease({ repo: "o/n", tag: "v1.0.0", gh: fake({ "repos/o/n/compare/main...c1": { status: "diverged" } }) }).release;
  assert.equal(r.onDefaultBranch, false);
});

test("collector: a missing tag reports the commit as gone", () => {
  const r = collectRelease({ repo: "o/n", tag: "v9.9.9", gh: fake() }).release;
  assert.equal(r.commitExists, false);
});

test("collector: unreadable checks stay null, not empty", () => {
  const r = collectRelease({ repo: "o/n", tag: "v1.0.0", sha: "c1", gh: (p) => { if (p.includes("check-runs")) throw new Error("x"); return fake()(p); } }).release;
  assert.equal(r.checks, null);
});
