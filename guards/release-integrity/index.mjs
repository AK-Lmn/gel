// No node imports here: this file also runs in a browser. It judges one release, so it needs `ctx.release`, which
// `gel release-ctx` collects from the GitHub API (lib/release-ctx.mjs). Without it (every pull request and push)
// it passes. It adds what the org release-gate workflow does not check:
//   - the tag is a valid SemVer version
//   - the tag points to a commit that exists and is on the default branch (not an unreviewed branch)
//   - CHANGELOG has an entry for exactly this version
//   - every check on that exact commit finished green, and the repo's required checks are among them
//   - no earlier release workflow run on that commit failed or was cancelled
//   - release files have checksums, and an SBOM when the repo asks for one
// `ctx.release.assets` is null before publishing; the file checks then wait for the post-publish run.
// gel.json: "release_integrity": { "changelog": true, "changelog_files": [...], "require": ["GEL guards"],
//   "ignore": "^(Release gate|release|publish)", "release_workflow": "release", "checksums": true, "sbom": false }
export const name = "release-integrity";

const SEMVER = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const CHANGELOGS = ["CHANGELOG.md", "CHANGELOG", "CHANGES.md", "HISTORY.md", "docs/CHANGELOG.md", "RELEASES.md"];
const GREEN = new Set(["success", "skipped", "neutral"]);
const SUMS = /(^|[-_.])(sha256|sha512|sha1|checksums?)(sums?)?(\.|$|[-_.])|\.(sha256|sha512|sha1|md5)$/i;
const SIGN = /\.(sig|asc|pem|crt|sigstore|intoto\.jsonl)$/i;
const SBOM = /(sbom|\.spdx|\.cdx|cyclonedx)/i;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function run({ cfg, ctx, read }) {
  const r = ctx?.release;
  if (!r) return { pass: true, findings: [] };
  const c = cfg?.release_integrity ?? {};
  const findings = [];
  const at = (file, message) => findings.push({ file, line: 0, message });
  const tag = String(r.tag ?? "");
  const version = tag.replace(/^v/, "");

  if (!SEMVER.test(tag)) at("release", `tag "${tag}" is not a valid SemVer version (1.2.3, v1.2.3, 1.2.3-rc.1)`);
  if (r.commitExists === false) at("release", `tag ${tag} points to a commit that does not exist${r.sha ? ` (${String(r.sha).slice(0, 7)})` : ""}`);
  else if (r.onDefaultBranch === false) at("release", `tag ${tag} points to a commit that is not on the default branch, so it was never reviewed and merged`);

  if (c.changelog !== false && SEMVER.test(tag)) {
    const files = c.changelog_files ?? CHANGELOGS;
    const found = files.map((f) => [f, read?.(f)]).filter(([, t]) => t != null);
    const re = new RegExp(`^#{1,6}\\s*\\[?v?${esc(version)}\\]?(?=\\s|$|[-–—(:])`, "m");
    if (!found.length) at("CHANGELOG.md", "no CHANGELOG file; add one with an entry for each release (or set release_integrity.changelog to false)");
    else if (!found.some(([, t]) => re.test(t))) at(found[0][0], `${found[0][0]} has no entry for ${version}`);
  }

  if (Array.isArray(r.checks)) {
    const ignore = new RegExp(c.ignore ?? "^(Release gate|release|publish)");
    const checks = r.checks.filter((k) => !ignore.test(k.name));
    if (!checks.length) at("release", `no checks ran on ${String(r.sha ?? "the release commit").slice(0, 7)}: a release needs a verified commit`);
    for (const k of checks) if (k.status !== "completed" || !GREEN.has(k.conclusion)) at("release", `check "${k.name}" is ${k.status === "completed" ? k.conclusion : k.status} on the release commit`);
    for (const need of c.require ?? []) {
      const ok = checks.some((k) => (k.name === need || k.name.endsWith(` / ${need}`)) && k.conclusion === "success");
      if (!ok) at("release", `required check "${need}" is missing or not green on the release commit`);
    }
  }

  const wf = new RegExp(c.release_workflow ?? "release", "i");
  for (const w of r.workflowRuns ?? []) if (wf.test(w.name) && ["failure", "cancelled", "timed_out"].includes(w.conclusion)) at("release", `an earlier "${w.name}" run on this commit ${w.conclusion}: fix it or re-run it before releasing again`);

  if (Array.isArray(r.assets)) {
    const names = r.assets.map((a) => (typeof a === "string" ? a : a.name));
    const files = names.filter((n) => !SUMS.test(n) && !SIGN.test(n) && !SBOM.test(n));
    if (c.checksums !== false && files.length) {
      const one = names.some((n) => /^(sha256|sha512|checksums?)(sums?)?(\.|$)|(^|[-_.])(sha256|sha512|checksums?)(sums?)?(\.txt)?$/i.test(n));
      const missing = files.filter((f) => !one && !names.includes(`${f}.sha256`) && !names.includes(`${f}.sha512`));
      if (missing.length) at("release", `${missing.length} release file${missing.length > 1 ? "s" : ""} without a checksum (${missing.slice(0, 3).join(", ")}${missing.length > 3 ? ", ..." : ""}); publish a checksums file`);
    }
    if (c.sbom === true && !names.some((n) => SBOM.test(n))) at("release", "no SBOM among the release files, and release_integrity.sbom is true");
  }
  return { pass: findings.length === 0, findings };
}
