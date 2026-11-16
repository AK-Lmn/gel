import { walk, readText } from "../../lib/fs.mjs";

export const name = "repo-hygiene";
export const owner = "gel";
export const threshold = { min: 0.8 };

// The standard files every flisk-sh repo carries. A missing one is listed so the fix is obvious.
export function run({ root }) {
  const files = new Set(walk(root));
  const has = (re) => [...files].some((f) => re.test(f));
  const workflows = [...files].filter((f) => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(f));
  const hasPkg = files.has("package.json");
  const checks = [
    ["README", files.has("README.md")],
    ["LICENSE", has(/^LICENSE(\.md|\.txt)?$/)],
    [".gitignore", files.has(".gitignore")],
    ["GEL caller workflow", workflows.some((f) => /flisk-sh\/gel|uses:\s*\.\/|gel/i.test(readText(root, f) ?? "") && /gel/i.test(f))],
    ["gel.json", files.has("gel.json")],
    ["a CI workflow", workflows.length > 0],
    ["workflows declare permissions", workflows.length > 0 && workflows.every((f) => /^permissions:/m.test(readText(root, f) ?? ""))],
    ["SECURITY.md or org policy", files.has("SECURITY.md") || files.has(".github/SECURITY.md")],
    ["lockfile next to package.json", !hasPkg || has(/(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|bun\.lock)$/)],
  ];
  const missing = checks.filter(([, ok]) => !ok).map(([n]) => ({ missing: n }));
  return { score: (checks.length - missing.length) / checks.length, detail: `${checks.length - missing.length} of ${checks.length} standard items present`, items: missing };
}
