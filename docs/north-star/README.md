# North Star: GEL

Serves the org North Star: [docs/NORTH_STAR.md](https://github.com/flisk-sh/.github/blob/main/docs/NORTH_STAR.md).

# North star: catch rate against trufflehog

Claim: on the same planted secrets, GEL `secret-scan` catches at least 1.5x as many as trufflehog.

Measure: `gel north-star --measure` runs `node bench/north-star.mjs`. It writes 8 fake secrets, one per file
(built from parts at run time, never committed), runs both scanners and counts the files each one flags.

Last result: GEL 5 of 8, trufflehog 3 of 8 (1.67x, seed 7).

Limits, stated plainly:
- 8 cases, one seeded run. It shows direction, not a precise rate.
- trufflehog ran with `--no-verification` (no network), so it only used its detectors. With verification on, it
  would confirm live keys, which GEL does not try to do.
- GEL skips test paths by design, so the "key in a test file" case is a miss for GEL. It is counted, not hidden.
- GEL misses the Google key (`AIza...`) and the password in a URL; trufflehog catches the URL one.
- The planted set is GEL's own bench set, so it favours the kinds GEL was built for. A fair rerun needs a
  third-party corpus.
