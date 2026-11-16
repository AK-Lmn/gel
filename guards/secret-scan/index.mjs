import { readText, isTestPath } from "../../lib/fs.mjs";

export const name = "secret-scan";
const RULES = [
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["GitHub token", /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})\b/],
  ["Anthropic key", /\bsk-ant-[A-Za-z0-9_-]{20,}/],
  ["OpenAI key", /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}/],
  ["Stripe live key", /\b[sr]k_live_[A-Za-z0-9]{16,}/],
  ["Slack token", /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ["Private key", /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/],
];

// Docs and guides show made-up keys; a value that reads like one is not a leak.
const PLACEHOLDER = /1234567890|0123456789|abcdefghij|example|xxxxxx|your[_-]|placeholder|dummy|redacted|fake/i;
// Sample TLS keys shipped with examples, and tests kept in a t/ folder (celery, Perl).
const SAMPLE = /(^|\/)(examples?|samples?)\/.*\.(pem|key|crt)$|(^|\/)t\/(unit|integration|functional)\//;

// ctx.files: files to scan (the changed files, or all of them).
export function run({ root, files }) {
  const findings = [];
  for (const f of files) {
    if (isTestPath(f) || SAMPLE.test(f)) continue; // fake keys live in test fixtures and examples
    if (/\.(lock|svg|png|jpg|gif|ico|woff2?)$/.test(f)) continue;
    const text = readText(root, f);
    if (text === null) continue;
    text.split("\n").forEach((line, i) => {
      for (const [label, re] of RULES) { const m = line.match(re); if (m && !PLACEHOLDER.test(m[0])) findings.push({ file: f, line: i + 1, message: `${label} (rotate it, then remove it)` }); }
    });
  }
  return { pass: findings.length === 0, findings };
}
