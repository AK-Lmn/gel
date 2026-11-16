// The loop: run records plus a person's labels -> per-guard numbers and promote/demote advice.
// Advice only. GEL never edits gel.json; a person does, in a lane C pull request, with these numbers as evidence.
import { readFileSync, existsSync } from "node:fs";

// The rules, in one place so a change to them is a reviewed change.
export const RULES = {
  promote: { minRuns: 20, minLabelled: 5, minPrecision: 0.95 },
  demote: { maxPrecision: 0.95, minFalse: 1 },
};

export function readRecords(paths) {
  const out = [];
  for (const p of paths) {
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      if (!line.trim()) continue;
      try { out.push(JSON.parse(line)); } catch { /* a cut line at the end of an artifact */ }
    }
  }
  return out;
}

export function percentile(xs, p) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
}

const key = (f) => `${f.guard}|${f.file}|${f.line ?? 0}`;

export function metrics(records, labels = [], cfg = { guards: {} }) {
  const verdict = new Map(labels.map((l) => [key(l), l.verdict]));
  const guards = {};
  for (const r of records) {
    for (const g of r.results ?? []) {
      const m = (guards[g.guard] ??= { guard: g.guard, level: cfg.guards?.[g.guard] ?? g.level, runs: 0, failed: 0, findings: 0, real: 0, false: 0, unlabelled: 0, mined: [] });
      m.runs++;
      if (!g.pass) m.failed++;
      m.findings += g.findings ?? 0;
      for (const f of g.top ?? []) {
        const v = verdict.get(key({ guard: g.guard, ...f }));
        if (v === "real") m.real++;
        else if (v === "false") { m.false++; m.mined.push({ file: f.file, line: f.line, message: f.message, repo: r.repo, sha: r.sha }); }
        else m.unlabelled++;
      }
    }
  }
  for (const m of Object.values(guards)) {
    const labelled = m.real + m.false;
    m.precision = labelled ? m.real / labelled : null;
    m.failRate = m.runs ? m.failed / m.runs : 0;
    m.advice = advise(m, labelled);
  }
  const ms = records.map((r) => r.ms).filter((x) => typeof x === "number");
  const lanes = { A: 0, B: 0, C: 0 };
  for (const r of records) if (r.lane in lanes) lanes[r.lane]++;
  return {
    runs: records.length,
    repos: new Set(records.map((r) => r.repo).filter(Boolean)).size,
    lanes,
    needsPerson: records.filter((r) => r.needsPerson).length,
    // first pass: no guard had a finding on the run
    firstPass: records.length ? records.filter((r) => (r.results ?? []).every((g) => g.pass)).length / records.length : null,
    blockedRuns: records.filter((r) => (r.blocked ?? []).length).length,
    msP50: percentile(ms, 50),
    msP95: percentile(ms, 95),
    rules: RULES,
    guards: Object.values(guards),
  };
}

function advise(m, labelled) {
  const { promote, demote } = RULES;
  if (m.level === "block") {
    if (m.false >= demote.minFalse && m.precision !== null && m.precision < demote.maxPrecision)
      return { action: "demote", why: `${m.false} of ${labelled} labelled findings were false (precision ${(m.precision * 100).toFixed(0)}%)` };
    return { action: "keep", why: labelled ? `precision ${(m.precision * 100).toFixed(0)}% on ${labelled} labelled` : "no labels yet" };
  }
  const missing = [];
  if (m.runs < promote.minRuns) missing.push(`${promote.minRuns - m.runs} more runs`);
  if (labelled < promote.minLabelled) missing.push(`${promote.minLabelled - labelled} more labelled findings`);
  if (m.precision !== null && m.precision < promote.minPrecision) missing.push(`precision ${(m.precision * 100).toFixed(0)}% is under ${promote.minPrecision * 100}%`);
  if (missing.length) return { action: "hold", why: `needs ${missing.join(", ")}` };
  return { action: "promote", why: `${m.runs} runs, ${labelled} labelled, precision ${(m.precision * 100).toFixed(0)}%` };
}

const pct = (x) => (x === null ? "-" : `${(x * 100).toFixed(0)}%`);
export function metricsMarkdown(r) {
  const lines = [
    `## GEL metrics: ${r.runs} runs in ${r.repos} repos`,
    "",
    `Lanes A ${r.lanes.A} / B ${r.lanes.B} / C ${r.lanes.C} (a person approved ${r.needsPerson}). First pass ${pct(r.firstPass)}. Blocked runs ${r.blockedRuns}. Guard time p50 ${r.msP50 ?? "-"} ms, p95 ${r.msP95 ?? "-"} ms.`,
    "",
    "| Guard | Level | Runs | Fail rate | Labelled real / false | Precision | Advice |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const g of r.guards) lines.push(`| ${g.guard} | ${g.level} | ${g.runs} | ${pct(g.failRate)} | ${g.real} / ${g.false} | ${pct(g.precision)} | **${g.advice.action}**: ${g.advice.why} |`);
  const mined = r.guards.flatMap((g) => g.mined.map((m) => ({ guard: g.guard, ...m })));
  if (mined.length) {
    lines.push("", "### Hard cases to add", "Each false alarm becomes a `good` case in `guards/<guard>/cases.json` before the guard is fixed.");
    for (const m of mined.slice(0, 30)) lines.push(`- ${m.guard}: ${m.repo ?? ""} ${m.file}:${m.line} ${m.message}`);
  }
  lines.push("", "GEL does not change gel.json. To promote or demote, a person edits it in a pull request (lane C) and links this table.");
  return lines.join("\n");
}
