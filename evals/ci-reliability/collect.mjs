import { execFileSync } from "node:child_process";

// Last runs of one repo as the eval's input. Needs the gh CLI (or GH_TOKEN) and read access to the repo.
export function collectRuns(repo, limit = 200) {
  const out = execFileSync("gh", ["run", "list", "-R", repo, "--limit", String(limit), "--json", "workflowName,headSha,conclusion,startedAt,updatedAt"], { encoding: "utf8", maxBuffer: 1 << 26 });
  return JSON.parse(out).map((r) => ({ workflow: r.workflowName, sha: r.headSha, conclusion: r.conclusion, ms: Date.parse(r.updatedAt) - Date.parse(r.startedAt) || null }));
}
