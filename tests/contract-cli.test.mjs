// The before-and-after guards through the real CLI: a git repo, a base commit, a branch that breaks things.
import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const gel = join(dirname(fileURLToPath(import.meta.url)), "..", "bin", "gel.mjs");
const SPEC = "openapi: 3.0.3\npaths:\n  /orders:\n    get:\n      responses:\n        \"200\":\n          description: ok\n    delete:\n      responses:\n        \"204\":\n          description: gone\n";

function repo() {
  const root = mkdtempSync(join(tmpdir(), "gel-contract-"));
  const git = (...a) => execFileSync("git", a, { cwd: root, encoding: "utf8" });
  const put = (f, t) => { mkdirSync(dirname(join(root, f)), { recursive: true }); writeFileSync(join(root, f), t); };
  git("init", "-q", "-b", "main");
  git("config", "user.email", "t@example.com"); git("config", "user.name", "t");
  put("openapi.yaml", SPEC);
  put("db/migrate/001_users.rb", "create_table :users\n");
  git("add", "-A"); git("commit", "-q", "-m", "base");
  const base = git("rev-parse", "HEAD").trim();
  git("checkout", "-q", "-b", "change");
  return { root, git, put, base };
}
const run = (root, base) => {
  const rec = join(root, "..", `${root.split("/").pop()}.jsonl`);
  execFileSync(process.execPath, [gel, "run", "--root", root, "--base", base, "--record", rec], { encoding: "utf8" });
  return JSON.parse(readFileSync(rec, "utf8").trim().split("\n").pop());
};
const result = (r, g) => r.results.find((x) => x.guard === g);

test("a branch that edits a merged migration and removes an endpoint is reported", () => {
  const { root, git, put, base } = repo();
  put("db/migrate/001_users.rb", "create_table :users do |t| t.string :email end\n");
  put("openapi.yaml", SPEC.replace(/    delete:[\s\S]*$/, ""));
  git("commit", "-qam", "break");
  const r = run(root, base);
  assert.equal(result(r, "migrations-append-only").pass, false);
  assert.match(result(r, "migrations-append-only").top[0].message, /edited/);
  assert.equal(result(r, "api-contract").pass, false);
  assert.match(result(r, "api-contract").top[0].message, /DELETE \/orders was removed/);
  rmSync(root, { recursive: true, force: true });
});

test("a branch that renames a migration is reported under its old path", () => {
  const { root, git, base } = repo();
  renameSync(join(root, "db/migrate/001_users.rb"), join(root, "db/migrate/002_users.rb"));
  git("add", "-A"); git("commit", "-qm", "rename");
  const r = run(root, base);
  assert.equal(result(r, "migrations-append-only").top[0].file, "db/migrate/001_users.rb");
  assert.match(result(r, "migrations-append-only").top[0].message, /renamed to db\/migrate\/002_users.rb/);
  rmSync(root, { recursive: true, force: true });
});

test("adding a migration and an endpoint passes, and so does a scan with no base", () => {
  const { root, git, put, base } = repo();
  put("db/migrate/002_email.rb", "add_column :users, :email, :string\n");
  put("openapi.yaml", SPEC + "  /health:\n    get:\n      responses:\n        \"200\":\n          description: ok\n");
  git("add", "-A"); git("commit", "-qm", "add");
  for (const b of [base, ""]) {
    const r = run(root, b);
    assert.equal(result(r, "migrations-append-only").pass, true);
    assert.equal(result(r, "api-contract").pass, true);
  }
  rmSync(root, { recursive: true, force: true });
});
