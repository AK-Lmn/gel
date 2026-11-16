// No node imports here: this file also runs in a browser (Cilytics scans a repo live). `read(file)` returns the
// file text or null; the CLI supplies it (lib/guards.mjs), a browser passes its own.
export const name = "pinned-actions";
const SHA = /@[0-9a-f]{40}\b/;
const TAG = /^([^/@]+)\/[^@]+@(?:v\d+(?:\.\d+)*|main)$/;

// Owners whose actions may be pinned by tag: GEL itself, the repo's own owner,
// and any owner listed in gel.json "trusted_owners".
function trusted(cfg) {
  const t = new Set(cfg?.trusted_owners ?? []);
  const own = (cfg?.repo ?? globalThis.process?.env?.GITHUB_REPOSITORY ?? "").split("/")[0];
  if (own) t.add(own);
  return t;
}

export function run({ files, cfg, read }) {
  const owners = trusted(cfg);
  const findings = [];
  const targets = files.filter((f) => /^\.github\/(workflows|actions)\/.+\.ya?ml$/.test(f) || /(^|\/)action\.ya?ml$/.test(f));
  for (const f of targets) {
    const text = read(f);
    if (text === null) continue;
    text.split("\n").forEach((line, i) => {
      const m = line.match(/^\s*(?:-\s*)?uses:\s*["']?([^\s"'#]+)/);
      if (!m) return;
      const ref = m[1];
      if (ref.startsWith("./") || ref.startsWith("docker://")) return;
      if (SHA.test(ref)) return;
      if (/^flisk-sh\/gel(\/|@)/.test(ref) && TAG.test(ref)) return;
      const tag = ref.match(TAG);
      if (tag && owners.has(tag[1])) return;
      findings.push({ file: f, line: i + 1, message: `${ref} is not pinned to a commit SHA` });
    });
  }
  return { pass: findings.length === 0, findings };
}
