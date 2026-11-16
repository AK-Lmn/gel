import { test } from "node:test";
import assert from "node:assert/strict";
import { metrics, percentile } from "../lib/metrics.mjs";

const rec = (pass, extra = {}) => ({
  repo: "o/r", sha: "abc", lane: "B", needsPerson: false, ms: 40, blocked: [],
  results: [{ guard: "secret-scan", level: "report", pass, findings: pass ? 0 : 1, top: pass ? [] : [{ file: `src/k${extra.i ?? 0}.js`, line: 3, message: "AWS key" }] }],
  ...extra,
});

test("percentile", () => {
  assert.equal(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 50), 5);
  assert.equal(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95), 10);
  assert.equal(percentile([], 50), null);
});

test("hold until there are enough runs and labels", () => {
  const r = metrics([rec(true), rec(false)]);
  const g = r.guards[0];
  assert.equal(g.advice.action, "hold");
  assert.match(g.advice.why, /more runs/);
  assert.equal(r.firstPass, 0.5);
});

test("promote with 20 runs and 5 real labels", () => {
  const recs = Array.from({ length: 20 }, (_, i) => rec(i >= 5, { i }));
  const labels = Array.from({ length: 5 }, (_, i) => ({ guard: "secret-scan", file: `src/k${i}.js`, line: 3, verdict: "real" }));
  const g = metrics(recs, labels).guards[0];
  assert.equal(g.precision, 1);
  assert.equal(g.advice.action, "promote");
});

test("a false alarm on a blocking guard means demote, and it is mined as a hard case", () => {
  const recs = [rec(false, { i: 1 }), rec(false, { i: 2 })];
  const labels = [{ guard: "secret-scan", file: "src/k1.js", line: 3, verdict: "false" }, { guard: "secret-scan", file: "src/k2.js", line: 3, verdict: "real" }];
  const g = metrics(recs, labels, { guards: { "secret-scan": "block" } }).guards[0];
  assert.equal(g.advice.action, "demote");
  assert.equal(g.mined.length, 1);
  assert.equal(g.mined[0].file, "src/k1.js");
});

test("never promotes with an unknown precision", () => {
  const recs = Array.from({ length: 30 }, () => rec(true));
  assert.equal(metrics(recs).guards[0].advice.action, "hold");
});
