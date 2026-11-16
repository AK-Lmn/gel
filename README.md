# GEL: Guard, Eval, Loop

One reusable GitHub Actions workflow for every flisk-sh repo. A repo adds a 10-line caller and a `gel.json`; a fix here reaches all of them.

| | Guard | Eval | Loop |
| --- | --- | --- | --- |
| Answers | May this ship? | How good is it? | Can it be better? |
| Result | pass or fail | score vs baseline | a pull request or nothing |
| Model | never | never judges | proposes only |

This first version ships the **guards**, the **lane picker**, the **run record** and the **eval of the guards**. Per-repo evals and loops (like `chat/evals/answers`) plug in next.

## Guards (all start in report mode)

| Guard | Fails when |
| --- | --- |
| `secret-scan` | a key, token or private key is in a file |
| `pinned-actions` | a workflow uses an action not pinned to a commit SHA (our own `flisk-sh/*@vN` is allowed) |
| `dead-links` | a markdown or HTML link points to a file that is not in the repo |
| `done-without-green` | a pull request says "all checks green" while a check on it is red |

## Lanes, picked from the changed files (never from a label)

- **A** docs, tests, copy: guards only.
- **B** product code: guards and evals.
- **C** workflows, `gel.json`, eval cases and baselines, auth, payment, secrets, migrations, Dockerfiles, deploy config: a person approves.

## Eval of the guards

Each guard has `guards/<name>/cases.json`: labelled good and bad cases. `node bin/gel.mjs selftest` must catch every bad case and block no good one, or CI fails. A complaint becomes a case first, then a guard.

## Use in a repo

`.github/workflows/gel.yml` (from `templates/caller.yml`) and `gel.json` (from `templates/gel.json`). Mode `report` never blocks. A person promotes a guard to `block` in `gel.json` after the run records show it was right.

Each run uploads `gel-record.jsonl`: repo, commit, lane, each guard result, time.

## Roll out

```bash
node scripts/rollout.mjs            # dry run: which repos would get a pull request
node scripts/rollout.mjs --apply    # open one pull request per repo
```

A loop may open pull requests. It may not edit `gel.json`, cases or workflows: those are lane C.

MIT.
