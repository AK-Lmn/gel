# North Star: GEL

Serves the org North Star: [docs/NORTH_STAR.md](https://github.com/flisk-sh/.github/blob/main/docs/NORTH_STAR.md).

**Claim:** GEL points at 5x or more of the planted defects the repos' own CI would catch. GEL's own rate, hard cases
included, is the number to watch: 78% on the last run, and it should stay above 70%.

**Measure:** `gel north-star --measure` runs `bench/run.mjs` on the 30 public repos in `bench/corpus.json`, each pinned
to a commit, and counts planted defects GEL points at (file and line). Method: `bench/README.md`.

**Last result:** GEL 540 of 690 (78%) vs 33 for the repos' own CI (16x). Seeds 0, 1, 2 gave 78.3%, 78.0%, 77.8%. With the pinned-actions guard disabled it
fell to 450 (65%), so the number tracks the guards.

**What is in the 22% GEL misses:** a Google API key, a password in a database URL, an AWS key in a test file, a
write scope a job does not need, an HTML link in markdown. They are outside the rules or skipped on purpose, and are
counted, not hidden.

**Limits:**
- The planted defects are GEL's own list, so the rate favours the kinds GEL was built for.
- On a corpus trufflehog wrote (360 provider secrets), GEL's secret scan caught 1 and trufflehog 312. GEL is a
  gate for the common mistakes, not a broad secret detector, and this metric does not claim otherwise.
- The repos' own CI caught about 5% in the same bench, but that only reads workflow files for a named tool. It
  ignores push protection and pre-commit hooks, so treat it as an upper bound on the gap, not a measured one.
- One seed is committed. Other seeds moved the rate by under 0.5 points.
