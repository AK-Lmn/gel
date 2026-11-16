import { matchAny } from "./glob.mjs";

// Lane C: a person approves. Chosen from the changed files, never from a label.
export const DEFAULT_LANE_C = [
  ".github/workflows/**", ".github/actions/**", "gel.json", "evals/**/baseline*", "evals/**/cases.json",
  "**/auth/**", "**/login/**", "**/payment*/**", "**/billing/**", "**/secrets/**", "**/migrations/**",
  "**/Dockerfile*", "wrangler.toml", "wrangler.jsonc", "**/wrangler.toml", "render.yaml", "**/*.tf",
];
// Lane A: docs, tests, copy. Guards only.
export const DEFAULT_LANE_A = [
  "**/*.md", "docs/**", "**/*.txt", "tests/**", "test/**", "**/*.test.*", "**/*.spec.*", "**/__tests__/**",
  "**/*.png", "**/*.jpg", "**/*.svg", "LICENSE", ".gitignore",
];

export function pickLane(files, cfg = {}) {
  const laneC = cfg.laneC ?? DEFAULT_LANE_C;
  const laneA = cfg.laneA ?? DEFAULT_LANE_A;
  if (!files.length) return { lane: "A", reason: "no changed files" };
  const c = files.filter((f) => matchAny(laneC, f));
  if (c.length) return { lane: "C", reason: `sensitive path: ${c[0]}` };
  const nonA = files.filter((f) => !matchAny(laneA, f));
  if (nonA.length) return { lane: "B", reason: `product code: ${nonA[0]}` };
  return { lane: "A", reason: "docs, tests and copy only" };
}
