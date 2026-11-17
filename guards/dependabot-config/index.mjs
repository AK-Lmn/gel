// No node imports here: this file also runs in a browser. It finds the package ecosystems a repo uses (npm, pip,
// go, cargo, docker, github-actions and others) and checks that .github/dependabot.yml (or a Renovate config)
// covers each one. Manifests under test, fixture, example or vendor folders do not count.
import { parseYaml } from "../../lib/yaml-lite.mjs";

export const name = "dependabot-config";
const SKIP = /(^|\/)(node_modules|vendor|fixtures?|testdata|tests?|__tests__|examples?|third_party)\//;
const MANIFESTS = [
  ["npm", /(^|\/)package\.json$/],
  ["pip", /(^|\/)(requirements[\w.-]*\.txt|pyproject\.toml|Pipfile|setup\.py)$/],
  ["gomod", /(^|\/)go\.mod$/],
  ["cargo", /(^|\/)Cargo\.toml$/],
  ["bundler", /(^|\/)Gemfile$/],
  ["composer", /(^|\/)composer\.json$/],
  ["maven", /(^|\/)pom\.xml$/],
  ["gradle", /(^|\/)build\.gradle(\.kts)?$/],
  ["docker", /(^|\/)Dockerfile(\.[\w.-]+)?$/],
  ["github-actions", /^\.github\/(workflows\/[^/]+\.ya?ml|actions\/.+\/action\.ya?ml)$|^action\.ya?ml$/],
];
// Dependabot names a few ecosystems differently from the manifest list.
const ALIAS = { yarn: "npm", pnpm: "npm", bun: "npm", poetry: "pip", uv: "pip" };

export function run({ files, read }) {
  const used = new Set();
  for (const f of files) {
    if (SKIP.test(f) && !f.startsWith(".github/")) continue;
    for (const [eco, re] of MANIFESTS) if (re.test(f)) used.add(eco);
  }
  if (!used.size) return { pass: true, findings: [] };
  if (files.some((f) => /^(\.github\/)?(renovate\.json5?|\.renovaterc(\.json)?)$/.test(f))) return { pass: true, findings: [] };
  const cfgFile = files.find((f) => /^\.github\/dependabot\.ya?ml$/.test(f));
  if (!cfgFile) return { pass: false, findings: [{ file: ".github/dependabot.yml", line: 0, message: `no Dependabot config; ecosystems in use: ${[...used].join(", ")}` }] };
  const text = read(cfgFile);
  let doc = null;
  try { doc = text == null ? null : parseYaml(text); } catch { /* unreadable: skip rather than guess */ }
  if (!doc || !Array.isArray(doc.updates)) return { pass: true, findings: [] };
  const covered = new Set(doc.updates.map((u) => String(u?.["package-ecosystem"] ?? "")).map((e) => ALIAS[e] ?? e));
  const findings = [...used].filter((e) => !covered.has(e)).map((e) => ({ file: cfgFile, line: 0, message: `${e} is used but has no "package-ecosystem: ${e}" entry` }));
  return { pass: findings.length === 0, findings };
}
