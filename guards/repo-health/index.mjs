// No node imports here: this file also runs in a browser. It checks the files every public repository should
// carry: a licence, a security policy, contribution instructions, an owner (CODEOWNERS) and a README that says
// what the repo is for. A file the organisation supplies from its `.github` repo can be listed in gel.json
// "repo_health.inherit" (LICENSE, SECURITY, CONTRIBUTING, CODEOWNERS) so a repo is not asked to copy it.
export const name = "repo-health";

const WANT = {
  LICENSE: { re: /^(?:licen[cs]e|copying|unlicense)(?:[.-][\w.-]+)?$/i, dirs: [""], what: "a LICENSE file" },
  SECURITY: { re: /^security\.md$/i, dirs: ["", ".github/", "docs/"], what: "a SECURITY.md (how to report a vulnerability)" },
  CONTRIBUTING: { re: /^contributing\.md$/i, dirs: ["", ".github/", "docs/"], what: "a CONTRIBUTING.md" },
  CODEOWNERS: { re: /^codeowners$/i, dirs: ["", ".github/", "docs/"], what: "a CODEOWNERS file (who owns this repo)" },
};

function has(files, { re, dirs }) {
  return files.some((f) => {
    const i = f.lastIndexOf("/");
    return dirs.includes(i < 0 ? "" : f.slice(0, i + 1)) && re.test(f.slice(i + 1));
  });
}

// A README purpose is a prose line of 40+ characters that is not a heading, badge, image, link-only line or table.
function purpose(text) {
  return text.split("\n").some((l) => {
    const t = l.trim();
    if (t.length < 40 || /^(#|!\[|\[!\[|<|\||[-*>]\s*$|```)/.test(t)) return false;
    return !/^\[[^\]]*\]\([^)]*\)$/.test(t);
  });
}

export function run({ files, cfg, read }) {
  const inherit = new Set((cfg?.repo_health?.inherit ?? []).map((s) => String(s).toUpperCase()));
  const findings = [];
  for (const [key, spec] of Object.entries(WANT)) {
    if (inherit.has(key) || has(files, spec)) continue;
    findings.push({ file: key === "LICENSE" ? "LICENSE" : spec.dirs[1] ? `${spec.dirs[1]}${key}.md`.replace("CODEOWNERS.md", "CODEOWNERS") : key, line: 0, message: `missing ${spec.what}` });
  }
  const readme = files.find((f) => /^readme(\.(md|markdown|mdx|rst|txt))?$/i.test(f));
  if (!readme) findings.push({ file: "README.md", line: 0, message: "missing a README" });
  else {
    const text = read(readme);
    if (text !== null && !purpose(text)) findings.push({ file: readme, line: 0, message: "README has no sentence saying what this repo is for" });
  }
  return { pass: findings.length === 0, findings };
}
