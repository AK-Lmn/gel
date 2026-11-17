import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../lib/config.mjs";
import { pickLane } from "../lib/lane.mjs";

test("docs/gel.json is read, and a root gel.json is not", () => {
  const d = mkdtempSync(join(tmpdir(), "cfg-"));
  mkdirSync(join(d, "docs"));
  writeFileSync(join(d, "gel.json"), JSON.stringify({ mode: "report", ignore: ["root"] }));
  writeFileSync(join(d, "docs", "gel.json"), JSON.stringify({ mode: "report", ignore: ["docs"] }));
  assert.deepEqual(loadConfig(d).ignore, ["docs"]);
});

test("a root gel.json alone is ignored, with a message that says where to move it", () => {
  const d = mkdtempSync(join(tmpdir(), "cfg-"));
  writeFileSync(join(d, "gel.json"), JSON.stringify({ mode: "report", ignore: ["root"] }));
  const seen = [];
  const orig = console.error; console.error = (m) => seen.push(m);
  try { assert.deepEqual(loadConfig(d).ignore, []); } finally { console.error = orig; }
  assert.match(seen.join("\n"), /docs\/gel\.json/);
});

test("a change to docs/gel.json is lane C, not docs lane A", () => {
  assert.equal(pickLane(["docs/gel.json"]).lane, "C");
});
