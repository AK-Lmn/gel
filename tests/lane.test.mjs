import { test } from "node:test";
import assert from "node:assert/strict";
import { pickLane } from "../lib/lane.mjs";
import { globToRegExp } from "../lib/glob.mjs";
import { loadConfig } from "../lib/config.mjs";

test("docs and tests only is lane A", () => assert.equal(pickLane(["README.md", "docs/a.md", "src/a.test.ts"]).lane, "A"));
test("product code is lane B", () => assert.equal(pickLane(["README.md", "src/app.ts"]).lane, "B"));
test("workflow change is lane C even next to docs", () => assert.equal(pickLane(["README.md", ".github/workflows/ci.yml"]).lane, "C"));
test("auth and payment paths are lane C", () => {
  assert.equal(pickLane(["src/auth/session.ts"]).lane, "C");
  assert.equal(pickLane(["api/payments/charge.ts"]).lane, "C");
});
test("docs/gel.json and eval cases are lane C: a loop cannot change its own policy", () => {
  assert.equal(pickLane(["docs/gel.json"]).lane, "C");
  assert.equal(pickLane(["evals/answers/cases.json"]).lane, "C");
});
test("no files is lane A", () => assert.equal(pickLane([]).lane, "A"));
test("glob", () => {
  assert.ok(globToRegExp("**/*.md").test("a/b/c.md"));
  assert.ok(globToRegExp("**/*.md").test("c.md"));
  assert.ok(!globToRegExp("*.md").test("a/c.md"));
});
test("report mode downgrades block", () => {
  const cfg = loadConfig("/nonexistent");
  assert.equal(cfg.mode, "report");
  assert.ok(Object.values(cfg.guards).every((v) => v === "report"));
});
test("labels, guard cases and the bench baseline are lane C: the loop cannot grade itself", () => {
  for (const f of ["gel-labels.json", "guards/secret-scan/cases.json", "bench/baseline.json"]) assert.equal(pickLane([f]).lane, "C", f);
});
