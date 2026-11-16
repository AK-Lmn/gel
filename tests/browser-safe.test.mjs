// pinned-actions and workflow-permissions read workflow files only, so Cilytics runs them in a browser on files it
// fetched. That works only while they import nothing from node and take their files through `read`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const WORKFLOW = ".github/workflows/ci.yml";
const FILES = { [WORKFLOW]: "on: push\njobs:\n  a:\n    steps:\n      - uses: actions/checkout@v4\n" };
const read = (f) => FILES[f] ?? null;

for (const guard of ["pinned-actions", "workflow-permissions"]) {
  test(`${guard} has no node import`, () => {
    const src = readFileSync(new URL(`../guards/${guard}/index.mjs`, import.meta.url), "utf8");
    assert.doesNotMatch(src, /^\s*import\b/m);
    assert.doesNotMatch(src, /\bfrom\s+["']node:/);
  });

  test(`${guard} judges files given through read, with no root`, async () => {
    const m = await import(`../guards/${guard}/index.mjs`);
    const res = m.run({ files: [WORKFLOW], cfg: {}, read });
    assert.equal(res.pass, false);
    assert.equal(res.findings[0].file, WORKFLOW);
  });

  test(`${guard} skips a file read cannot supply`, async () => {
    const m = await import(`../guards/${guard}/index.mjs`);
    assert.equal(m.run({ files: [WORKFLOW], cfg: {}, read: () => null }).pass, true);
  });
}
