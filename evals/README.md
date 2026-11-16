# Evals

Guards say pass or fail on one change. Evals score a repo from 0 to 1 against a threshold and a baseline.
Everything is deterministic: files, diffs and run history in, a number out. No model, no network (except `eval collect`, which calls `gh`).

| layer | what | command |
|---|---|---|
| 0 | guards: pass/fail on a change | `gel run`, `gel selftest` |
| 1 | evals: a score per repo | `gel eval [--only a,b] [--runs runs.json] [--baseline b.json] [--record f] [--strict]` |
| 2 | evals of evals: can a guard or eval be trusted (flaky, misses bad changes, false alarms, drift) | `gel meta <gel-record.jsonl> [--evals f] [--outcomes f]` |
| 3 | planted-defect cases that check layer 1 and 2 | `gel eval selftest`, `gel meta selftest` |

Evals: `change-risk` (is the lane GEL picks the lane a person would pick, under-classifying fails), `ci-reliability`
(flaky workflow-commits, first-pass rate, duration p50/p95), `repo-hygiene` (standard files present), `test-strength`
(test files that assert something; a static check, not mutation testing).

Report mode by default; `--strict` fails on a score under its threshold or a drop under the baseline.
Each eval is a folder `evals/<name>/{index.mjs,cases.json}`. `cases.json` must hold at least 3 cases and one planted-low case.
Changing a `cases.json` or a baseline is a lane C change.
Not covered yet: architecture conformance, runtime reliability, release reproducibility, observability, cost, recovery.
