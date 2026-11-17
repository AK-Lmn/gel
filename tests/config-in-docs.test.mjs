import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../lib/config.mjs";
import { pickLane } from "../lib/lane.mjs";

test("docs/gel.json is read, and wins over a root gel.json", () => {
  const d = mkdtempSync(join(tmpdir(), "cfg-"));
  mkdirSync(join(d, "docs"));
  writeFileSync(join(d, "gel.json"), JSON.stringify({ mode: "report", ignore: ["root"] }));
  writeFileSync(join(d, "docs", "gel.json"), JSON.stringify({ mode: "report", ignore: ["docs"] }));
  assert.deepEqual(loadConfig(d).ignore, ["docs"]);
});

test("a root gel.json still works when docs/gel.json is absent", () => {
  const d = mkdtempSync(join(tmpdir(), "cfg-"));
  writeFileSync(join(d, "gel.json"), JSON.stringify({ mode: "report", ignore: ["root"] }));
  assert.deepEqual(loadConfig(d).ignore, ["root"]);
});

test("a change to docs/gel.json is lane C, not docs lane A", () => {
  assert.equal(pickLane(["docs/gel.json"]).lane, "C");
});
