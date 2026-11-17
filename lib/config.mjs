import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { GUARD_NAMES } from "./guards.mjs";

// mode "report": nothing blocks. A guard is promoted to "block" in gel.json by a person, with the records as proof.
export const DEFAULTS = { mode: "report", guards: Object.fromEntries(GUARD_NAMES.map((g) => [g, "report"])), laneC: null, laneA: null, ignore: [], trusted_owners: [] };

export function loadConfig(root) {
  // The config lives in docs/ so a repo root stays clean; a root gel.json still works and docs/gel.json wins.
  const p = [join(root, "docs", "gel.json"), join(root, "gel.json")].find((f) => existsSync(f)) ?? join(root, "gel.json");
  const user = existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : {};
  const cfg = { ...DEFAULTS, ...user, guards: { ...DEFAULTS.guards, ...(user.guards ?? {}) } };
  if (cfg.mode === "report") for (const g of Object.keys(cfg.guards)) if (cfg.guards[g] === "block") cfg.guards[g] = "report";
  return cfg;
}
