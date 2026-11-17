#!/usr/bin/env node
// GEL bench: the guards on real public repos pinned to a commit.
//   node bench/run.mjs [--work <dir>] [--out bench/results.json]
// 1. clean: every guard on the untouched repo. Secret findings here are false alarms.
// 2. planted: one defect at a time in a seeded random place; did the guard point at it?
// 3. without GEL: would the repo's own workflows catch the same class of defect?
// Fake keys are built from parts at run time, so no key is ever committed here.
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { walk, readText, isTestPath } from "../lib/fs.mjs";
import { GUARD_NAMES, loadGuard } from "../lib/guards.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const WORK = resolve(opt("work", join(here, ".work")));
const OUT = resolve(opt("out", join(here, "results.json")));
const corpus = JSON.parse(readFileSync(join(here, "corpus.json"), "utf8"));
const git = (cwd, ...a) => execFileSync("git", a, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });

// Seeded random, so every run plants in the same places.
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (r, xs) => xs[Math.floor(r() * xs.length)];
const chars = (r, set, n) => Array.from({ length: n }, () => set[Math.floor(r() * set.length)]).join("");
const UP = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const AN = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

// Each planted defect: where it goes, the line to add, and whether GEL is expected to catch it.
// "hard" ones are outside what the guards claim to cover; they show the limits.
const SECRETS = [
  { id: "aws-key", hard: false, make: (r) => ["AKIA", chars(r, UP, 16)].join("") },
  { id: "github-token", hard: false, make: (r) => ["gh", "p_", chars(r, AN, 36)].join("") },
  { id: "anthropic-key", hard: false, make: (r) => ["sk-", "ant-", "api03-", chars(r, AN, 40)].join("") },
  { id: "stripe-live-key", hard: false, make: (r) => ["sk", "_live_", chars(r, AN, 24)].join("") },
  { id: "private-key", hard: false, make: () => ["-----BEGIN ", "RSA PRIVATE", " KEY-----"].join("") },
  { id: "google-api-key", hard: true, make: (r) => ["AI", "za", chars(r, AN, 35)].join("") },
  { id: "password-in-url", hard: true, make: (r) => ["postgres://admin:", chars(r, AN, 18), "@db.internal:5432/app"].join("") },
  { id: "aws-key-in-test-file", hard: true, inTest: true, make: (r) => ["AKIA", chars(r, UP, 16)].join("") },
  // Outside list: formats from other scanners' default rules (gitleaks, trufflehog), not picked by GEL's authors.
  { id: "slack-bot-token", hard: true, outside: true, make: (r) => ["xo", "xb-", chars(r, "0123456789", 12), "-", chars(r, "0123456789", 12), "-", chars(r, AN, 24)].join("") },
  { id: "sendgrid-key", hard: true, outside: true, make: (r) => ["S", "G.", chars(r, AN, 22), ".", chars(r, AN, 43)].join("") },
  { id: "npm-token", hard: true, outside: true, make: (r) => ["np", "m_", chars(r, AN, 36)].join("") },
  { id: "gitlab-token", hard: true, outside: true, make: (r) => ["gl", "pat-", chars(r, AN, 20)].join("") },
  { id: "openai-project-key", hard: true, outside: true, make: (r) => ["sk-", "proj-", chars(r, AN, 48)].join("") },
  { id: "twilio-key", hard: true, outside: true, make: (r) => ["S", "K", chars(r, "0123456789abcdef", 32)].join("") },
];
const ACTIONS = [
  { id: "tag-pin", hard: false, line: "      - uses: actions/checkout@v4" },
  { id: "branch-pin", hard: false, line: "      - uses: docker/build-push-action@master" },
  { id: "semver-pin", hard: false, line: "      - uses: actions/setup-node@v4.1.0" },
];
const LINKS = [
  { id: "missing-doc", hard: false, line: "See [the guide](docs/gel-bench-missing-guide.md)." },
  { id: "missing-image", hard: false, line: "![diagram](images/gel-bench-missing.png)" },
  { id: "missing-with-anchor", hard: false, line: "See [setup](./gel-bench-missing.md#install)." },
  { id: "html-href", hard: true, line: '<a href="gel-bench-missing.html">old page</a>' },
];
// Each one is a whole new workflow file; "hard" asks for a scope the job does not need, which GEL cannot judge.
const PERMS = [
  { id: "no-permissions", hard: false, body: "name: gel-bench\non: [push]\njobs:\n  bench:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo bench\n" },
  { id: "write-all", hard: false, body: "name: gel-bench\non: [push]\npermissions: write-all\njobs:\n  bench:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo bench\n" },
  { id: "prt-head-checkout", hard: false, body: "name: gel-bench\non:\n  pull_request_target:\npermissions:\n  contents: read\njobs:\n  bench:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n      - run: npm test\n" },
  // Outside list: zizmor's template-injection audit (untrusted text expanded inside a run step).
  { id: "template-injection", hard: true, outside: true, body: "name: gel-bench\non:\n  issues:\n    types: [opened]\npermissions:\n  contents: read\njobs:\n  bench:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo \"${{ github.event.issue.title }}\"\n" },
  { id: "scope-not-needed", hard: true, body: "name: gel-bench\non: [push]\npermissions:\n  contents: write\njobs:\n  bench:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo read only\n" },
];
const CLAIMS = [
  { id: "claims-green-red-check", bad: true, ctx: { claim: "Fixed the parser. All checks pass, ready to merge.", checkRuns: [{ name: "test", conclusion: "failure" }, { name: "lint", conclusion: "success" }] } },
  { id: "claims-green-timed-out", bad: true, ctx: { claim: "All tests passing", checkRuns: [{ name: "e2e", conclusion: "timed_out" }] } },
  { id: "claims-green-is-green", bad: false, ctx: { claim: "All checks pass.", checkRuns: [{ name: "test", conclusion: "success" }] } },
  { id: "no-claim-red-check", bad: false, ctx: { claim: "WIP: test still failing", checkRuns: [{ name: "test", conclusion: "failure" }] } },
];

// Tools a repo's own CI could use to catch the same class of defect.
const OWN_TOOLS = {
  secrets: /gitleaks|trufflehog|detect-secrets|ggshield|secretlint|talisman|kingfisher/i,
  pins: /zizmor|pinact|ratchet|harden-runner|ensure-sha-pinned|poutine/i,
  perms: /zizmor|poutine|scorecard/i,
  links: /lychee|markdown-link-check|linkinator|linkcheck|markdown-link|htmlproofer|mlc\b/i,
  claims: /a^/, // no common tool checks a PR's words against its checks
};

function checkout({ repo, sha }) {
  const dir = join(WORK, repo.replace("/", "__"));
  if (!existsSync(join(dir, ".git"))) {
    mkdirSync(dir, { recursive: true });
    git(dir, "init", "-q");
    git(dir, "remote", "add", "origin", `https://github.com/${repo}.git`);
  }
  git(dir, "fetch", "-q", "--depth", "1", "origin", sha);
  git(dir, "checkout", "-q", "--force", sha);
  return dir;
}
function safeHead(dir) { try { return git(dir, "rev-parse", "HEAD").trim(); } catch { return ""; } }
function restore(dir) { git(dir, "checkout", "-q", "--", "."); git(dir, "clean", "-fdq"); }
function addLine(dir, file, line) {
  const p = join(dir, file);
  mkdirSync(dirname(p), { recursive: true });
  const old = existsSync(p) ? readFileSync(p, "utf8") : "";
  writeFileSync(p, old + (old && !old.endsWith("\n") ? "\n" : "") + line + "\n");
  return old.split("\n").length - (old.endsWith("\n") || !old ? 1 : 0) + 1;
}
function workflowText(dir) {
  const wf = join(dir, ".github", "workflows");
  if (!existsSync(wf)) return "";
  return readdirSync(wf).filter((f) => /\.ya?ml$/.test(f)).map((f) => readFileSync(join(wf, f), "utf8")).join("\n");
}

async function main() {
  mkdirSync(WORK, { recursive: true });
  const guards = Object.fromEntries(await Promise.all(GUARD_NAMES.map(async (n) => [n, await loadGuard(n)])));
  const repos = [];
  for (const [idx, entry] of corpus.entries()) {
    const r = rng(1000 + idx);
    let dir;
    try {
      dir = join(WORK, entry.repo.replace("/", "__"));
      if (safeHead(dir) !== entry.sha) dir = checkout(entry);
    } catch (e) { console.error(`skip ${entry.repo}: ${e.message.split("\n")[0]}`); continue; }
    restore(dir);
    const all = walk(dir);
    const cfg = { repo: entry.repo };
    const row = { repo: entry.repo, sha: entry.sha, files: all.length, clean: {}, planted: [], ownCi: {} };

    // 1. clean
    const t0 = performance.now();
    for (const n of GUARD_NAMES) {
      const res = await guards[n].run({ root: dir, files: all, ctx: {}, cfg });
      row.clean[n] = res.findings.length;
      if (n === "secret-scan" || n === "dead-links" || n === "workflow-permissions") row.clean[`${n}:sample`] = res.findings.slice(0, 5).map((f) => `${f.file}:${f.line} ${f.message}`);
    }
    row.ms = Math.round(performance.now() - t0);

    // 2. planted
    const src = all.filter((f) => /\.(js|ts|tsx|mjs|py|go|rs|rb|java|json|ya?ml|toml|sh|env|cfg|ini)$/.test(f) && !isTestPath(f) && !/(^|\/)(package-lock|yarn|pnpm-lock|Cargo)\b/.test(f) && readText(dir, f) !== null);
    const tests = all.filter((f) => isTestPath(f) && /\.(js|ts|py|go|rs|json)$/.test(f));
    const mds = all.filter((f) => /\.md$/i.test(f) && !isTestPath(f) && !/(^|\/)templates?\//.test(f));
    const wfs = all.filter((f) => /^\.github\/workflows\/.+\.ya?ml$/.test(f));
    const plant = async (kind, d, file, line, guardName, files) => {
      const at = addLine(dir, file, line);
      const res = await guards[guardName].run({ root: dir, files: files ?? [file], ctx: {}, cfg });
      const caught = res.findings.some((f) => f.file === file && (!f.line || f.line === at));
      row.planted.push({ kind, id: d.id, hard: d.hard, file, caught });
      restore(dir);
    };
    for (const d of SECRETS) {
      const pool = d.inTest ? tests : src;
      const file = pool.length ? pick(r, pool) : (d.inTest ? "test/gel_bench_fixture.js" : "src/gel_bench_config.js");
      await plant("secret", d, file, `const GEL_BENCH = "${d.make(r)}";`, "secret-scan");
    }
    for (const d of ACTIONS) {
      const file = wfs.length ? pick(r, wfs) : ".github/workflows/gel-bench.yml";
      await plant("action", d, file, d.line, "pinned-actions");
    }
    for (const d of LINKS) {
      const file = mds.length ? pick(r, mds) : "README.md";
      await plant("link", d, file, d.line, "dead-links", null);
      // dead-links walks the whole tree in GEL, so give it every file plus the planted one
    }
    for (const d of PERMS) {
      const file = ".github/workflows/gel-bench-perm.yml";
      addLine(dir, file, d.body.trimEnd());
      const res = await guards["workflow-permissions"].run({ root: dir, files: [file], ctx: {}, cfg });
      row.planted.push({ kind: "perm", id: d.id, hard: d.hard, file, caught: res.findings.some((f) => f.file === file) });
      restore(dir);
    }
    for (const d of CLAIMS) {
      const res = await guards["done-without-green"].run({ root: dir, files: [], ctx: d.ctx, cfg });
      row.planted.push({ kind: "claim", id: d.id, hard: false, expectBad: d.bad, caught: d.bad ? !res.pass : res.pass });
    }

    // 3. without GEL
    const wf = workflowText(dir);
    row.workflows = wfs.length;
    for (const [k, re] of Object.entries(OWN_TOOLS)) row.ownCi[k] = re.test(wf);
    repos.push(row);
    console.log(`${entry.repo.padEnd(42)} files ${String(all.length).padStart(5)}  ${row.ms} ms  clean ${GUARD_NAMES.map((n) => row.clean[n]).join("/")}  planted ${row.planted.filter((p) => p.caught).length}/${row.planted.length}`);
  }

  // Summary.
  const by = (pred) => { const xs = repos.flatMap((x) => x.planted.filter(pred)); return { n: xs.length, caught: xs.filter((p) => p.caught).length }; };
  const kinds = ["secret", "action", "perm", "link", "claim"];
  const ownKey = { secret: "secrets", action: "pins", perm: "perms", link: "links", claim: "claims" };
  const summary = {
    date: new Date().toISOString().slice(0, 10),
    repos: repos.length,
    files: repos.reduce((s, x) => s + x.files, 0),
    perKind: Object.fromEntries(kinds.map((k) => [k, {
      covered: by((p) => p.kind === k && !p.hard),
      hard: by((p) => p.kind === k && p.hard),
      withoutGel: repos.filter((x) => x.ownCi[ownKey[k]]).length,
    }])),
    perDefect: Object.fromEntries([...new Set(repos.flatMap((x) => x.planted.map((p) => p.id)))].map((id) => [id, by((p) => p.id === id)])),
    clean: Object.fromEntries(GUARD_NAMES.map((n) => [n, { reposWithFindings: repos.filter((x) => x.clean[n] > 0).length, findings: repos.reduce((s, x) => s + x.clean[n], 0) }])),
    msP50: [...repos.map((x) => x.ms)].sort((a, b) => a - b)[Math.floor(repos.length / 2)],
    msP95: [...repos.map((x) => x.ms)].sort((a, b) => a - b)[Math.floor(repos.length * 0.95)],
  };
  // keep the real-PR track (bench/claims.mjs) that lives in the same file
  const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
  writeFileSync(OUT, JSON.stringify({ ...prev, summary, repos }, null, 1) + "\n");
  console.log(JSON.stringify(summary, null, 1));
}
main().catch((e) => { console.error(e); process.exit(1); });
