// Layer 1: evals. A guard says pass or fail on a change. An eval gives a repo a score from 0 to 1 and is compared
// with a threshold and a baseline. Deterministic: files, diffs and run history in, a number out. No model, no network.
import { pathToFileURL, fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { readFileSync, existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
export const EVAL_NAMES = ["change-risk", "ci-reliability", "repo-hygiene", "test-strength"];
export const evalDir = (n) => join(here, "..", "evals", n);
export const TOLERANCE = 0.02; // a score may move this much without counting as a drop

export async function loadEval(n) {
  const m = await import(pathToFileURL(join(evalDir(n), "index.mjs")).href);
  return m;
}

// status: "ok" (at or over the threshold), "below" (under it), "skip" (no data to score)
export async function runEval(name, { root, ctx = {} }) {
  const e = await loadEval(name);
  const t = Date.now();
  const r = await e.run({ root, ctx });
  const status = r.score === null ? "skip" : r.score >= e.threshold.min && r.pass !== false ? "ok" : "below";
  return { eval: name, owner: e.owner, threshold: e.threshold.min, score: r.score, status, detail: r.detail, items: (r.items ?? []).slice(0, 20), ms: Date.now() - t };
}

// Ratchet: an eval may not fall more than TOLERANCE under its recorded baseline. Raising the baseline is a lane C change.
export function ratchet(results, baseline = {}) {
  return results.map((r) => {
    const b = baseline[r.eval];
    const dropped = typeof b === "number" && r.score !== null && r.score < b - TOLERANCE;
    return { ...r, baseline: b ?? null, dropped };
  });
}

// The evals are checked too: each one has cases (a tree or a context, and the score it must land in).
export async function evalSelftest() {
  const rows = [];
  for (const n of EVAL_NAMES) {
    const cases = JSON.parse(readFileSync(join(evalDir(n), "cases.json"), "utf8"));
    const wrong = [];
    for (const c of cases) {
      const root = mkdtempSync(join(tmpdir(), "gel-eval-"));
      try {
        for (const [p, body] of Object.entries(c.files ?? {})) {
          mkdirSync(dirname(join(root, p)), { recursive: true });
          writeFileSync(join(root, p), Array.isArray(body) ? body.join("") : body);
        }
        const r = await runEval(n, { root, ctx: c.ctx ?? {} });
        const { min = 0, max = 1, status } = c.expect;
        if (r.score === null ? c.expect.score !== null : r.score < min - 1e-9 || r.score > max + 1e-9) wrong.push(`${c.name}: score ${r.score} not in [${min}, ${max}]`);
        if (status && r.status !== status) wrong.push(`${c.name}: status ${r.status}, expected ${status}`);
      } finally { rmSync(root, { recursive: true, force: true }); }
    }
    const lows = cases.filter((c) => c.expect.max !== undefined && c.expect.max < 0.9).length;
    rows.push({ eval: n, cases: cases.length, lows, wrong, ok: wrong.length === 0 && cases.length >= 3 && lows >= 1 });
  }
  return rows;
}

export const readJson = (p, d) => (p && existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : d);
