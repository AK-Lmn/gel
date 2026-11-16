import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseUses, pinLine, fixPinned, lsRemoteResolver } from "../lib/fix-pinned.mjs";
import { run as guard } from "../guards/pinned-actions/index.mjs";

const SHA = "3d3c42e5aac5ba805825da76410c181273ba90b1";

test("parseUses takes the repo from the first two path parts", () => {
  assert.deepEqual(parseUses("actions/checkout@v4"), { repo: "actions/checkout", ref: "v4" });
  assert.deepEqual(parseUses("github/codeql-action/init@v3"), { repo: "github/codeql-action", ref: "v3" });
  assert.equal(parseUses("foo@v1"), null);
  assert.equal(parseUses("a/b@${{ inputs.ref }}"), null);
});

test("pinLine keeps indent, dash and quotes, and adds the tag as a comment", () => {
  assert.equal(pinLine("      - uses: actions/checkout@v4", SHA), `      - uses: actions/checkout@${SHA} # v4`);
  assert.equal(pinLine(`    uses: "a/b/sub@main"`, SHA), `    uses: "a/b/sub@${SHA}" # main`);
  assert.equal(pinLine("  - uses: a/b@v2 # keep me", SHA), `  - uses: a/b@${SHA} # keep me`);
  assert.equal(pinLine("  - run: echo uses: a/b@v1", SHA), null);
});

test("lsRemoteResolver prefers the peeled commit of an annotated tag, then the tag, then a branch", () => {
  const out = (rows) => () => rows.map((r) => r.join("\t")).join("\n");
  const peeled = "a".repeat(40), tagObj = "b".repeat(40), head = "c".repeat(40);
  assert.equal(lsRemoteResolver(out([[tagObj, "refs/tags/v4"], [peeled, "refs/tags/v4^{}"]]))("x/y", "v4"), peeled);
  assert.equal(lsRemoteResolver(out([[tagObj, "refs/tags/v4"]]))("x/y", "v4"), tagObj);
  assert.equal(lsRemoteResolver(out([[head, "refs/heads/main"]]))("x/y", "main"), head);
  assert.equal(lsRemoteResolver(() => { throw new Error("offline"); })("x/y", "v4"), null);
});

test("fixPinned edits only the lines the guard reports, and the guard then passes", () => {
  const root = mkdtempSync(join(tmpdir(), "gel-fix-"));
  mkdirSync(join(root, ".github/workflows"), { recursive: true });
  const wf = ".github/workflows/ci.yml";
  writeFileSync(join(root, wf), "jobs:\n  a:\n    steps:\n      - uses: actions/checkout@v4\n      - uses: ./local\n      - uses: gone/away@v1\n");
  const read = (f) => readFileSync(join(root, f), "utf8");
  const before = guard({ files: [wf], cfg: {}, read });
  assert.equal(before.findings.length, 2);
  const res = fixPinned(root, before.findings, (repo) => (repo === "actions/checkout" ? SHA : null));
  assert.equal(res.pinned, 1);
  assert.deepEqual(res.unresolved.map((u) => u.why), ["gone/away@v1 not found"]);
  assert.match(read(wf), new RegExp(`actions/checkout@${SHA} # v4`));
  assert.match(read(wf), /uses: \.\/local/);
  const after = guard({ files: [wf], cfg: {}, read });
  assert.deepEqual(after.findings.map((f) => f.message), ["gone/away@v1 is not pinned to a commit SHA"]);
});
