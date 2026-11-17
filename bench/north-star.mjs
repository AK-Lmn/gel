#!/usr/bin/env node
// North star: secrets caught, GEL secret-scan vs trufflehog, on the same planted set.
//   node bench/north-star.mjs [--seed 7]
// Plants the 8 secret kinds from bench/run.mjs (fake, built from parts at run time), one per file,
// runs both scanners and prints {"value": gel caught, "baseline": trufflehog caught, "unit": ...}.
// trufflehog runs with --no-verification (no network), so only its detectors are compared.
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const seedArg = process.argv.indexOf("--seed");
const seed = seedArg >= 0 ? Number(process.argv[seedArg + 1]) : 7;
const { loadGuard } = await import(pathToFileURL(join(here, "..", "lib", "guards.mjs")).href);

function rng(s) { s >>>= 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const r = rng(seed);
const UP = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", AN = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const ch = (set, n) => Array.from({ length: n }, () => set[Math.floor(r() * set.length)]).join("");
const KINDS = [
  ["aws-key", () => ["AKIA", ch(UP, 16)].join("")],
  ["github-token", () => ["gh", "p_", ch(AN, 36)].join("")],
  ["anthropic-key", () => ["sk-", "ant-", "api03-", ch(AN, 40)].join("")],
  ["stripe-live-key", () => ["sk", "_live_", ch(AN, 24)].join("")],
  ["private-key", () => ["-----BEGIN ", "RSA PRIVATE", " KEY-----\n", ch(AN, 64), "\n-----END RSA PRIVATE KEY-----"].join("")],
  ["google-api-key", () => ["AI", "za", ch(AN, 35)].join("")],
  ["password-in-url", () => ["postgres://admin:", ch(AN, 18), "@db.internal:5432/app"].join("")],
  ["aws-key-in-test-file", () => ["AKIA", ch(UP, 16)].join("")],
];

const dir = mkdtempSync(join(process.env.TMPDIR || tmpdir(), "gel-ns-"));
try {
  mkdirSync(join(dir, "src"));
  const files = [];
  for (const [id, make] of KINDS) {
    const f = id.endsWith("test-file") ? `src/${id}.test.js` : `src/${id}.js`;
    writeFileSync(join(dir, f), `const X = "${make()}";\n`);
    files.push(f);
  }
  const guard = await loadGuard("secret-scan");
  const res = await guard.run({ root: dir, files, ctx: {}, cfg: {} });
  const gel = new Set(res.findings.map((f) => f.file));
  let out;
  try {
    out = execFileSync("trufflehog", ["filesystem", dir, "--no-verification", "--json", "--no-update"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch (e) {
    console.error("trufflehog failed or is not installed: brew install trufflehog");
    process.exit(2);
  }
  const tf = new Set();
  for (const l of out.split("\n")) {
    if (!l.trim()) continue;
    try { const p = JSON.parse(l)?.SourceMetadata?.Data?.Filesystem?.file; if (p) tf.add(p.slice(dir.length + 1)); } catch {}
  }
  const caught = (set) => files.filter((f) => set.has(f)).length;
  console.log(JSON.stringify({ value: caught(gel), baseline: caught(tf), unit: `of ${files.length} planted secrets`, runs: 1, seed }));
} finally {
  rmSync(dir, { recursive: true, force: true });
}
