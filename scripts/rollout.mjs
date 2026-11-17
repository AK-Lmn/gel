#!/usr/bin/env node
// Opens one pull request per repo in --org (default flisk-sh) that adds the GEL caller. Dry run unless --apply.
// Report only: gel.json starts in mode "report", so nothing can block on day one.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const apply = process.argv.includes("--apply");
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1].split(",") : null;
const org = (() => { const i = process.argv.indexOf("--org"); return i > 0 ? process.argv[i + 1] : "flisk-sh"; })();
const BRANCH = "gel/add-guards";
const gh = (...a) => execFileSync("gh", a, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const api = (...a) => JSON.parse(gh("api", ...a) || "null");
const b64 = (s) => Buffer.from(s).toString("base64");

const caller = readFileSync(join(here, "../templates/caller.yml"), "utf8");
const cfg = readFileSync(join(here, "../templates/gel.json"), "utf8");
const repos = JSON.parse(gh("repo", "list", org, "--limit", "300", "--no-archived", "--source", "--json", "name,defaultBranchRef"))
  .filter((r) => r.name !== "gel" && (!only || only.includes(r.name)));

for (const r of repos) {
  const repo = `${org}/${r.name}`;
  try {
    const base = r.defaultBranchRef?.name;
    if (!base) { console.log(`skip  ${repo} (empty)`); continue; }
    let exists = true;
    try { gh("api", `repos/${repo}/contents/.github/workflows/gel.yml?ref=${base}`); } catch { exists = false; }
    if (exists) { console.log(`skip  ${repo} (already has gel.yml)`); continue; }
    if (!apply) { console.log(`would ${repo} (${base})`); continue; }
    const sha = api(`repos/${repo}/git/ref/heads/${base}`).object.sha;
    try { gh("api", "-X", "POST", `repos/${repo}/git/refs`, "-f", `ref=refs/heads/${BRANCH}`, "-f", `sha=${sha}`); } catch { /* branch exists from an earlier run */ }
    for (const [path, body] of [[".github/workflows/gel.yml", caller], ["docs/gel.json", cfg]]) {
      let existing = null;
      try { existing = api(`repos/${repo}/contents/${path}?ref=${BRANCH}`).sha; } catch {}
      gh("api", "-X", "PUT", `repos/${repo}/contents/${path}`, "-f", `message=ci: add GEL guards (report only)\n\nSigned-off-by: flisk-sh <noreply@flisk.sh>`, "-f", `content=${b64(body)}`, "-f", `branch=${BRANCH}`, ...(existing ? ["-f", `sha=${existing}`] : []));
    }
    const out = gh("pr", "create", "-R", repo, "--base", base, "--head", BRANCH, "--title", "ci: add GEL guards (report only)",
      "--body", "Adds the 10-line GEL caller and a `docs/gel.json`. Report only: nothing blocks. It runs secret scan, pinned actions, dead links and done-without-green, and writes one record per run.\n\nSee https://github.com/flisk-sh/gel");
    console.log(`pr    ${repo} ${out.trim()}`);
  } catch (e) { console.log(`FAIL  ${repo} ${String(e.stderr ?? e.message).split("\n")[0]}`); }
}
