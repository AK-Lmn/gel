# GEL bench: method and limits

Every number on the GEL site comes from `results.json` in this folder. Run it yourself:

```bash
node bench/run.mjs       # 30 public repos, clean and planted (about 2 minutes, needs git)
node bench/claims.mjs    # real public pull requests (needs gh signed in)
```

## The repos

`corpus.json`: 30 public repos in 5 languages (TypeScript, JavaScript, Python, Go, Rust), from 3k to 80k stars, each pinned to one commit so a rerun sees the same files. 11,350 tracked files in all. None of them is ours.

## Track 1: clean repos

Every guard runs on every tracked file of the untouched repo. A secret found here is a false alarm, because the projects do not leak keys. A dead link found here was checked by hand (`triage.json`): real, false or unclear.

## Track 2: planted defects

One defect at a time is added to a file picked by a seeded random number, the guard runs, and the repo is restored. A defect counts as caught only when the guard points at the planted file and line. The fake keys are built from parts at run time, so no key is in this repo.

| Kind | Planted | Expected to catch |
| --- | --- | --- |
| secret | AWS, GitHub, Anthropic, Stripe live keys and a private key block, in source files | yes |
| secret | a Google API key, a password inside a database URL, an AWS key in a test file | no: not in the rules, or test files are skipped on purpose |
| action | `@v4`, `@master` and `@v4.1.0` on a third-party action | yes |
| perm | a workflow job with no `permissions`, `permissions: write-all`, a fork head checked out under `pull_request_target` (new file `.github/workflows/gel-bench-perm.yml`) | yes |
| perm | a job that sets a write scope it never uses | no: GEL checks a scope is set, not that it is needed |
| link | a missing doc, image, and doc with `#anchor` in markdown | yes |
| link | an HTML `<a href>` inside a markdown file | no: markdown files are read for markdown links only |
| claim | "all checks pass" with a red or timed-out check; and two that must not be flagged | yes |

The "no" rows are on the site as limits. They are there so the recall numbers are not 100% by choice of test.

## Track 3: without GEL

For each repo, its own `.github/workflows` are searched for a tool that catches the same kind of defect: gitleaks, trufflehog, detect-secrets, ggshield or secretlint for keys; zizmor, pinact, ratchet or harden-runner for pins; zizmor, poutine or scorecard for workflow permissions; lychee, markdown-link-check or linkinator for links. No common tool compares a PR's words with its checks.

This misses protection outside the workflows, such as GitHub push protection, pre-commit hooks and branch rules. It is a lower bound on what the repos already have.

A clean-repo `workflow-permissions` finding is checked by hand too (`triage.json`): 45 findings in 18 of 30 repos, 5 of 5 sampled were real. GEL cannot see an org's default token setting, so a real finding may still run with a read-only token.

## Track 4: real pull requests

GitHub search for public PRs created in a past window whose text says "all tests pass", "all checks pass" or "ready to merge". For each PR, the check runs on its last commit are read, and `done-without-green` runs on the title and body. A PR is flagged when it claims green and a check is failed, timed out, cancelled or waiting for action.

Limits: GEL cannot see which checks are required, so a red optional check (codecov, a visual diff) counts. 8 of the 35 flagged PRs had only checks like that red. A body may have been written before the last push.

## What changed because of the bench

The first run found GEL's own false alarms:

- Secrets: 26 findings on clean repos, all fake (doc placeholders, sample TLS keys, celery's `t/unit` tests). Now 0.
- Dead links: 217 findings, mostly from schemeless web links, URL-encoded names, doc-site links without `.md`, Vite `public/`, built `_site/`, symlinked READMEs, and a `[` on an earlier line that moved the reported line. Now 21, of which 5 real.

Recall on planted defects did not drop. `results-v1.0.json` is the first run, kept as it was.

## Ratchet

`bench/check.mjs` compares a run with `baseline.json` and fails when a kind's caught share drops or a guard's clean-repo findings rise. The nightly meta-eval runs it. `node bench/check.mjs --write` sets a new baseline; that change is lane C.
