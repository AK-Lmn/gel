// Collects `ctx.release` for the release-integrity guard from the GitHub API with the `gh` CLI. Read-only.
// `gh(path)` is injectable so the tests need no network. phase "pre" (before publishing) leaves `assets` null.
import { execFileSync } from "node:child_process";

const ghApi = (path) => JSON.parse(execFileSync("gh", ["api", path], { encoding: "utf8", maxBuffer: 1 << 28 }));

export function collectRelease({ repo, tag, sha, phase = "post", gh = ghApi }) {
  const tryGh = (p) => { try { return gh(p); } catch { return null; } };
  const out = { tag, sha: sha ?? null, commitExists: null, onDefaultBranch: null, checks: null, workflowRuns: null, assets: null };
  if (!out.sha) {
    let obj = tryGh(`repos/${repo}/git/ref/tags/${tag}`)?.object;
    if (obj?.type === "tag") obj = tryGh(`repos/${repo}/git/tags/${obj.sha}`)?.object;
    out.sha = obj?.sha ?? null;
  }
  if (!out.sha) { out.commitExists = false; return { release: out }; }
  out.commitExists = !!tryGh(`repos/${repo}/commits/${out.sha}`);
  if (!out.commitExists) return { release: out };
  const def = tryGh(`repos/${repo}`)?.default_branch;
  const cmp = def ? tryGh(`repos/${repo}/compare/${def}...${out.sha}`) : null;
  out.onDefaultBranch = cmp ? ["behind", "identical"].includes(cmp.status) : null;
  const runs = tryGh(`repos/${repo}/commits/${out.sha}/check-runs?per_page=100`);
  if (runs) out.checks = (runs.check_runs ?? []).map((k) => ({ name: k.name, status: k.status, conclusion: k.conclusion ?? null }));
  const wf = tryGh(`repos/${repo}/actions/runs?head_sha=${out.sha}&per_page=100`);
  if (wf) out.workflowRuns = (wf.workflow_runs ?? []).map((w) => ({ name: w.name, status: w.status, conclusion: w.conclusion ?? null }));
  if (phase === "post") {
    const rel = tryGh(`repos/${repo}/releases/tags/${tag}`);
    if (rel) out.assets = (rel.assets ?? []).map((a) => ({ name: a.name }));
  }
  return { release: out };
}
