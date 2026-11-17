import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { movedOnBase } from "../lib/diff.mjs";

const git = (cwd, ...a) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...a], { cwd, encoding: "utf8" }).trim();
const put = (cwd, f, body) => { mkdirSync(join(cwd, f, ".."), { recursive: true }); writeFileSync(join(cwd, f), body); };

test("stale-base has no node import", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../guards/stale-base/index.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(src, /\bfrom\s+["']node:/);
});

test("movedOnBase lists what the base changed after the branch forked, and gel run reports it", () => {
  const dir = mkdtempSync(join(tmpdir(), "gel-stale-"));
  try {
    git(dir, "init", "-q", "-b", "main");
    put(dir, "README.md", "x\n"); put(dir, ".github/workflows/ci.yml", "on: push\n");
    git(dir, "add", "-A"); git(dir, "commit", "-qm", "base");
    git(dir, "checkout", "-qb", "feature");
    put(dir, "src/a.ts", "export const a = 1;\n"); git(dir, "add", "-A"); git(dir, "commit", "-qm", "feature");
    git(dir, "checkout", "-q", "main");
    put(dir, ".github/workflows/ci.yml", "on: push\n# fixed\n"); put(dir, "other.md", "y\n");
    git(dir, "add", "-A"); git(dir, "commit", "-qm", "base moves");
    const base = git(dir, "rev-parse", "main");
    git(dir, "checkout", "-q", "feature");
    assert.deepEqual(movedOnBase(dir, base).sort(), [".github/workflows/ci.yml", "other.md"]);
    const out = execFileSync("node", [new URL("../bin/gel.mjs", import.meta.url).pathname, "run", "--root", dir, "--base", base], { cwd: dir, encoding: "utf8" });
    assert.match(out, /stale-base/);
    assert.match(out, /after this branch forked/);
    git(dir, "merge", "-q", "main", "-m", "merge main");
    const clean = execFileSync("node", [new URL("../bin/gel.mjs", import.meta.url).pathname, "run", "--root", dir, "--base", base], { cwd: dir, encoding: "utf8" });
    assert.doesNotMatch(clean, /after this branch forked/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("movedOnBase returns null with no base", () => {
  assert.equal(movedOnBase(".", null), null);
  assert.equal(movedOnBase(".", "0000000"), null);
});
