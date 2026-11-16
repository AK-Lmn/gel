// Layer 2: evals of evals. For each guard and eval, how far can its verdict be trusted?
// flakeRate  : same repo+sha gave different results (a check that disagrees with itself)
// missRate   : share of PASSED runs whose change later turned out bad (outcomes: [{repo, sha, bad}])
// falseAlarm : share of FAILED runs on changes that later turned out fine (a proxy: outcome known and good)
// drift      : mean eval score in the later half of the history minus the earlier half
export const LIMITS = { minRuns: 5, flake: 0.05, miss: 0.1, falseAlarm: 0.3, drop: 0.1 };

const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;

export function meta({ records = [], evalRecords = [], outcomes = [], limits = {} }) {
  const L = { ...LIMITS, ...limits };
  const bad = new Map(outcomes.map((o) => [`${o.repo}|${o.sha}`, !!o.bad]));
  const by = new Map();
  for (const r of records) {
    const k = r.guard ?? r.check;
    if (!k) continue;
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(r);
  }
  const out = [];
  for (const [name, rs] of by) {
    const seen = new Map();
    for (const r of rs) {
      const k = `${r.repo}|${r.sha}`;
      if (!seen.has(k)) seen.set(k, new Set());
      seen.get(k).add(r.result ?? (r.ok ? "pass" : "fail"));
    }
    const flaky = [...seen.values()].filter((s) => s.size > 1).length;
    const flakeRate = seen.size ? flaky / seen.size : 0;
    const passed = rs.filter((r) => (r.result ?? (r.ok ? "pass" : "fail")) === "pass");
    const failed = rs.filter((r) => (r.result ?? (r.ok ? "pass" : "fail")) === "fail");
    const known = (r) => bad.has(`${r.repo}|${r.sha}`);
    const pk = passed.filter(known), fk = failed.filter(known);
    const missRate = pk.length ? pk.filter((r) => bad.get(`${r.repo}|${r.sha}`)).length / pk.length : null;
    const falseAlarmRate = fk.length ? fk.filter((r) => !bad.get(`${r.repo}|${r.sha}`)).length / fk.length : null;
    const reasons = [];
    if (rs.length < L.minRuns) reasons.push(`only ${rs.length} runs`);
    else {
      if (flakeRate > L.flake) reasons.push(`flaky ${(flakeRate * 100).toFixed(0)}%`);
      if (missRate !== null && missRate > L.miss) reasons.push(`misses ${(missRate * 100).toFixed(0)}% of bad changes`);
      if (falseAlarmRate !== null && falseAlarmRate > L.falseAlarm) reasons.push(`false alarms ${(falseAlarmRate * 100).toFixed(0)}%`);
    }
    const verdict = rs.length < L.minRuns ? "unknown" : reasons.length ? "untrusted" : "trusted";
    out.push({ name, kind: "guard", runs: rs.length, flakeRate, missRate, falseAlarmRate, verdict, reasons });
  }
  const eby = new Map();
  for (const r of evalRecords) {
    if (typeof r.score !== "number") continue;
    if (!eby.has(r.eval)) eby.set(r.eval, []);
    eby.get(r.eval).push(r);
  }
  for (const [name, rs] of eby) {
    rs.sort((a, b) => String(a.at).localeCompare(String(b.at)));
    const h = Math.floor(rs.length / 2);
    const drift = rs.length >= 4 ? mean(rs.slice(h).map((r) => r.score)) - mean(rs.slice(0, h).map((r) => r.score)) : null;
    const reasons = [];
    if (rs.length < L.minRuns) reasons.push(`only ${rs.length} scores`);
    else if (drift !== null && drift < -L.drop) reasons.push(`score drifted ${drift.toFixed(2)}`);
    out.push({ name, kind: "eval", runs: rs.length, drift, verdict: rs.length < L.minRuns ? "unknown" : reasons.length ? "untrusted" : "trusted", reasons });
  }
  return out;
}

export function metaMarkdown(rows) {
  const f = (x) => (x === null || x === undefined ? "-" : (x * 100).toFixed(0) + "%");
  const lines = ["| check | kind | runs | flaky | misses | false alarms | verdict | why |", "|---|---|---|---|---|---|---|---|"];
  for (const r of rows) lines.push(`| ${r.name} | ${r.kind} | ${r.runs} | ${f(r.flakeRate)} | ${f(r.missRate)} | ${f(r.falseAlarmRate)} | ${r.verdict} | ${r.reasons.join("; ") || (r.drift != null ? `drift ${r.drift.toFixed(2)}` : "")} |`);
  return lines.join("\n");
}

// Layer 3: planted scenarios. If meta() cannot tell a planted-bad check from a clean one, its verdicts mean nothing.
export function metaSelftest(cases) {
  const wrong = [];
  for (const c of cases) {
    const rows = meta({ records: c.records ?? [], evalRecords: c.evalRecords ?? [], outcomes: c.outcomes ?? [] });
    const row = rows.find((r) => r.name === c.check);
    const got = row ? row.verdict : "none";
    if (got !== c.expect) wrong.push(`${c.name}: verdict ${got}, expected ${c.expect}`);
  }
  const kinds = new Set(cases.map((c) => c.expect));
  return { cases: cases.length, wrong, ok: wrong.length === 0 && kinds.has("trusted") && kinds.has("untrusted") && kinds.has("unknown") };
}
