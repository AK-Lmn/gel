import { pathToFileURL } from "node:url";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const GUARD_NAMES = ["secret-scan", "pinned-actions", "dead-links", "done-without-green"];
export const guardDir = (n) => join(here, "..", "guards", n);
export async function loadGuard(n) {
  return import(pathToFileURL(join(guardDir(n), "index.mjs")).href);
}
