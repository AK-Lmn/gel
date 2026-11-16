import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evalSelftest, ratchet, runEval } from "../lib/evals.mjs";
import { meta, metaSelftest } from "../lib/meta.mjs";

test("every eval passes its own planted cases", async () => {
  for (const r of await evalSelftest()) assert.ok(r.ok, `${r.eval}: ${r.wrong.join("; ")}`);
});
test("meta tells planted-bad checks from clean ones", () => {
  const res = metaSelftest(JSON.parse(readFileSync(new URL("../evals/meta/cases.json", import.meta.url), "utf8")));
  assert.ok(res.ok, res.wrong.join("; "));
});
test("the shipped change-risk dataset scores 1 on the current lane rules", async () => {
  const r = await runEval("change-risk", { root: ".", ctx: {} });
  assert.equal(r.score, 1, JSON.stringify(r.items));
});
test("ratchet flags a drop beyond tolerance only", () => {
  const rows = ratchet([{ eval: "x", score: 0.8 }, { eval: "y", score: 0.89 }], { x: 0.9, y: 0.9 });
  assert.equal(rows[0].dropped, true);
  assert.equal(rows[1].dropped, false);
});
test("meta says unknown, not trusted, on a small sample", () => {
  const rows = meta({ records: [{ guard: "g", repo: "r", sha: "a", result: "pass" }] });
  assert.equal(rows[0].verdict, "unknown");
});
