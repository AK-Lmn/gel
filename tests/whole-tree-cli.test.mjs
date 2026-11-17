// repo-health and dependabot-config judge the whole repo even on a pull request that touches one file: a LICENSE
// or a Dependabot config is never in a diff, so reading only the diff would flag every PR.
import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const gel = join(dirname(fileURLToPath(import.meta.url)), "..", "bin", "gel.mjs");

test("a PR that touches one file does not report files that exist elsewhere in the repo", () => {
  const root = mkdtempSync(join(tmpdir(), "gel-tree-"));
  const git = (...a) => execFileSync("git", a, { cwd: root, encoding: "utf8" });
  const put = (f, t) => { mkdirSync(dirname(join(root, f)), { recursive: true }); writeFileSync(join(root, f), t); };
  try {
    git("init", "-q", "-b", "main"); git("config", "user.email", "t@example.com"); git("config", "user.name", "t");
    put("README.md", "# t\n\nA small service that keeps the orders of a shop in one place.\n");
    put("LICENSE", "MIT\n"); put("SECURITY.md", "a\n"); put("CONTRIBUTING.md", "a\n"); put("CODEOWNERS", "* @a\n");
    put("package.json", "{}\n");
    put(".github/dependabot.yml", "version: 2\nupdates:\n  - package-ecosystem: npm\n    directory: /\n");
    git("add", "-A"); git("commit", "-q", "-m", "base");
    const base = git("rev-parse", "HEAD").trim();
    git("checkout", "-q", "-b", "change"); put("notes.txt", "hi\n"); git("add", "-A"); git("commit", "-q", "-m", "c");
    const rec = join(root, "..", `gel-record-${Date.now()}.jsonl`);
    execFileSync("node", [gel, "run", "--root", root, "--base", base, "--record", rec], { encoding: "utf8" });
    const res = JSON.parse(readFileSync(rec, "utf8").trim().split("\n").pop());
    rmSync(rec, { force: true });
    const by = Object.fromEntries((res.results ?? []).map((r) => [r.guard, r]));
    assert.equal(by["repo-health"]?.pass, true, JSON.stringify(by["repo-health"]));
    assert.equal(by["dependabot-config"]?.pass, true, JSON.stringify(by["dependabot-config"]));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
