import { pathToFileURL } from "node:url";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readText } from "./fs.mjs";

const here = dirname(fileURLToPath(import.meta.url));
export const GUARD_NAMES = ["secret-scan", "pinned-actions", "workflow-permissions", "dead-links", "done-without-green", "migrations-append-only", "api-contract", "tests-with-change", "adr-required", "repo-health", "status-declared", "dependabot-config", "release-integrity"];
export const guardDir = (n) => join(here, "..", "guards", n);
// Guards that read files get `read(file)` from here, so the same guard file runs on a checkout (node) and on
// files fetched in a browser. A caller may pass its own `read`.
export async function loadGuard(n) {
  const m = await import(pathToFileURL(join(guardDir(n), "index.mjs")).href);
  return { ...m, run: (a) => m.run({ read: (f) => readText(a.root, f), ...a }) };
}
