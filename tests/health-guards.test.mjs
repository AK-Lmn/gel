// repo-health, status-declared and dependabot-config run in a browser too (Cilytics): no node imports, and they
// judge only what `files`, `cfg`, `ctx` and `read` give them.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const GUARDS = ["repo-health", "status-declared", "dependabot-config"];

for (const g of GUARDS) {
  test(`${g} imports nothing from node`, () => {
    const src = readFileSync(new URL(`../guards/${g}/index.mjs`, import.meta.url), "utf8");
    assert.doesNotMatch(src, /\bfrom\s+["']node:/);
    assert.doesNotMatch(src, /\brequire\(/);
  });
}

test("repo-health passes a repo with every file and a real README line", async () => {
  const m = await import("../guards/repo-health/index.mjs");
  const files = { "README.md": "# x\n\nThis repo holds the thing that does the useful work.\n", LICENSE: "MIT", "SECURITY.md": "a", "CONTRIBUTING.md": "a", CODEOWNERS: "* @a" };
  assert.equal(m.run({ files: Object.keys(files), cfg: {}, read: (f) => files[f] ?? null }).pass, true);
});

test("status-declared skips the age check without ctx.lastCommitAt", async () => {
  const m = await import("../guards/status-declared/index.mjs");
  assert.equal(m.run({ cfg: { status: "active", owner: "@a/b" }, ctx: {} }).pass, true);
  assert.equal(m.run({ cfg: { status: "active", owner: "@a/b" } }).pass, true);
});

test("dependabot-config skips an unreadable dependabot file instead of guessing", async () => {
  const m = await import("../guards/dependabot-config/index.mjs");
  const files = ["package.json", ".github/dependabot.yml"];
  assert.equal(m.run({ files, cfg: {}, read: () => null }).pass, true);
});
