#!/usr/bin/env node
// Builds ctx.json for the done-without-green guard from the pull request event. Reads the event file, never a shell string.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const out = process.argv[2] ?? "gel-ctx.json";
const ctx = { claim: "", checkRuns: [] };
try {
  const ev = existsSync(process.env.GITHUB_EVENT_PATH ?? "") ? JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8")) : {};
  const pr = ev.pull_request;
  if (pr) {
    ctx.claim = `${pr.title ?? ""}\n${pr.body ?? ""}`;
    const res = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/commits/${pr.head.sha}/check-runs?per_page=100`, {
      headers: { authorization: `Bearer ${process.env.GITHUB_TOKEN}`, accept: "application/vnd.github+json" },
    });
    if (res.ok) {
      const data = await res.json();
      // leave out this very run (our jobs are named "GEL ...")
      ctx.checkRuns = data.check_runs.filter((c) => !/^gel\b/i.test(c.name)).map((c) => ({ name: c.name, conclusion: c.conclusion }));
    }
  }
} catch (e) { console.error(`gel-ctx: ${e.message}`); }
writeFileSync(out, JSON.stringify(ctx));
