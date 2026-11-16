// The caller template is copied into every repo by scripts/rollout.mjs, so it must pin GEL to a commit,
// not a moving tag: a tag that lags behind (v1 stayed on an old commit) gives new repos stale guards.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const caller = readFileSync(new URL("../templates/caller.yml", import.meta.url), "utf8");

test("caller template pins the reusable workflow and gel_ref to the same 40-char SHA", () => {
  const uses = caller.match(/uses: flisk-sh\/gel\/\.github\/workflows\/gel\.yml@(\S+)/)?.[1];
  const ref = caller.match(/gel_ref: ([^\s}]+)/)?.[1];
  assert.match(uses ?? "", /^[0-9a-f]{40}$/);
  assert.equal(ref, uses);
});
