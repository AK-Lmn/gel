// docs/gel.json is optional: a repo without it runs every guard in report mode, and the two guards that only
// check what the repo declared in it (status-declared, north-star) stay quiet instead of asking for the file.
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { loadConfig } from "../lib/config.mjs";
import { loadGuard } from "../lib/guards.mjs";

const repo = (cfg) => {
  const root = mkdtempSync(join(tmpdir(), "gel-cfg-"));
  if (cfg) { mkdirSync(join(root, "docs")); writeFileSync(join(root, "docs", "gel.json"), JSON.stringify(cfg)); }
  return root;
};

test("no docs/gel.json: config is the defaults and says no file exists", () => {
  const cfg = loadConfig(repo(null));
  assert.equal(cfg.noConfigFile, true);
  assert.equal(cfg.mode, "report");
});

test("with docs/gel.json the flag is absent", () => {
  assert.equal(loadConfig(repo({ status: "active" })).noConfigFile, undefined);
});

for (const g of ["status-declared", "north-star"]) {
  test(`${g} is quiet without a gel.json and still asks once the file exists`, async () => {
    const guard = await loadGuard(g);
    const none = repo(null), some = repo({});
    assert.equal((await guard.run({ root: none, files: [], ctx: {}, cfg: loadConfig(none) })).pass, true);
    assert.equal((await guard.run({ root: some, files: ["docs/gel.json"], ctx: {}, cfg: loadConfig(some) })).pass, false);
  });
}
