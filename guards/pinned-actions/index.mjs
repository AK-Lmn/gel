import { readText } from "../../lib/fs.mjs";

export const name = "pinned-actions";
const OWN = /^flisk-sh\/[^@]+@(?:v\d+|main)$/; // our own reusable workflows are pinned by tag
const SHA = /@[0-9a-f]{40}\b/;

export function run({ root, files }) {
  const findings = [];
  const targets = files.filter((f) => /^\.github\/(workflows|actions)\/.+\.ya?ml$/.test(f) || /(^|\/)action\.ya?ml$/.test(f));
  for (const f of targets) {
    const text = readText(root, f);
    if (text === null) continue;
    text.split("\n").forEach((line, i) => {
      const m = line.match(/^\s*(?:-\s*)?uses:\s*["']?([^\s"'#]+)/);
      if (!m) return;
      const ref = m[1];
      if (ref.startsWith("./") || ref.startsWith("docker://")) return;
      if (OWN.test(ref) || SHA.test(ref)) return;
      findings.push({ file: f, line: i + 1, message: `${ref} is not pinned to a commit SHA` });
    });
  }
  return { pass: findings.length === 0, findings };
}
