// No node imports here: this file also runs in a browser. `read(file)` returns the file text or null.

export const name = "workflow-permissions";
// Pre-flight on workflow config: the job token gets only what it needs, and a pull_request_target
// workflow never runs the pull request's own code with that token.
// Fails when:
//   - a workflow has no `permissions:` at the top and not on every job (the org default applies, often write)
//   - `permissions: write-all`
//   - `pull_request_target` checks out the pull request head
// A workflow that only runs as `workflow_call` gets its caller's token, so the caller is checked instead.

const TRIGGERS = /\b(push|pull_request|pull_request_target|schedule|workflow_dispatch|issues|issue_comment|release|merge_group|workflow_run|repository_dispatch|discussion|check_run|check_suite|create|delete|deployment|fork|gollum|label|milestone|page_build|public|registry_package|status|watch)\b/;

function onBlock(lines) {
  const i = lines.findIndex((l) => /^["']?on["']?\s*:/.test(l));
  if (i < 0) return "";
  const out = [lines[i].replace(/^["']?on["']?\s*:/, "")];
  for (let j = i + 1; j < lines.length && (/^\s/.test(lines[j]) || lines[j].trim() === ""); j++) out.push(lines[j]);
  return out.join("\n");
}

function jobs(lines) {
  // Job keys sit one indent level under `jobs:`; return each job's name, line and whether it sets permissions.
  const start = lines.findIndex((l) => /^jobs\s*:/.test(l));
  if (start < 0) return [];
  let indent = null;
  let bodyInd = null;
  const out = [];
  for (let j = start + 1; j < lines.length; j++) {
    const l = lines[j];
    if (l.trim() === "" || /^\s*#/.test(l)) continue;
    if (!/^\s/.test(l)) break;
    const ind = l.match(/^(\s*)/)[1].length;
    if (indent === null) indent = ind;
    if (ind === indent) { out.push({ name: l.trim().split(":")[0], line: j + 1, perms: false }); bodyInd = null; continue; }
    if (!out.length) continue;
    if (bodyInd === null) bodyInd = ind; // the job's own keys sit at its first body line's indent
    if (ind === bodyInd && /^\s*permissions\s*:/.test(l)) out.at(-1).perms = true;
  }
  return out;
}

export function run({ files, read }) {
  const findings = [];
  for (const f of files.filter((x) => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(x))) {
    const text = read(f);
    if (text === null) continue;
    const lines = text.split("\n");
    const on = onBlock(lines);
    const onlyCall = /workflow_call/.test(on) && !TRIGGERS.test(on.replace(/workflow_call/g, ""));
    lines.forEach((l, i) => {
      if (/^\s*permissions\s*:\s*["']?write-all["']?\s*(#.*)?$/.test(l)) findings.push({ file: f, line: i + 1, message: "permissions: write-all gives the token every scope" });
    });
    if (/pull_request_target/.test(on)) {
      lines.forEach((l, i) => {
        if (/^\s*ref\s*:.*github\.event\.pull_request\.head\.(sha|ref)|^\s*ref\s*:.*github\.head_ref/.test(l))
          findings.push({ file: f, line: i + 1, message: "pull_request_target checks out the pull request's own code with a write token" });
      });
    }
    if (onlyCall) continue;
    const top = lines.some((l) => /^permissions\s*:/.test(l));
    if (top) continue;
    const js = jobs(lines);
    const missing = js.filter((j) => !j.perms);
    if (js.length === 0 || missing.length === 0) continue;
    findings.push({ file: f, line: missing[0].line, message: `no permissions: at the top or on job "${missing[0].name}", so the token gets the repo default` });
  }
  return { pass: findings.length === 0, findings };
}
