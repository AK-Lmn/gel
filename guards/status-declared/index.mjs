// No node imports here: this file also runs in a browser. A repo that opts in with a docs/gel.json says in it what it is and who owns it:
//   { "status": "production|active|experimental|archived", "owner": "@team-or-person" }
// That is the data the portfolio table is built from. A repo marked `active` or `production` whose last commit
// is over `stale_after_days` (default 365) old is flagged: mark it experimental or archive it. The age comes
// from ctx.lastCommitAt (an ISO date) when the runner supplies it; without it the age check is skipped.
export const name = "status-declared";
export const STATUSES = ["production", "active", "experimental", "archived"];

export function run({ cfg, ctx }) {
  // gel.json is optional: a repo that has none has declared nothing, so there is nothing to check (and nothing to nag about).
  if (cfg?.noConfigFile) return { pass: true, findings: [] };
  const findings = [];
  const at = (message) => findings.push({ file: "gel.json", line: 0, message });
  const status = cfg?.status;
  if (status == null) at(`gel.json has no "status" (one of ${STATUSES.join(", ")})`);
  else if (!STATUSES.includes(status)) at(`gel.json status "${status}" is not one of ${STATUSES.join(", ")}`);
  const owner = cfg?.owner;
  if (typeof owner !== "string" || !/^@?[\w.-]+(\/[\w.-]+)?$/.test(owner.trim())) at(`gel.json has no "owner" (a GitHub user or team, such as @flisk-sh/core)`);
  const last = ctx?.lastCommitAt ? Date.parse(ctx.lastCommitAt) : NaN;
  const now = ctx?.now ? Date.parse(ctx.now) : Date.now();
  const limit = (cfg?.stale_after_days ?? 365) * 86400000;
  if ((status === "active" || status === "production") && !Number.isNaN(last) && now - last > limit)
    at(`status is "${status}" but the last commit was ${Math.floor((now - last) / 86400000)} days ago: mark it experimental or archived`);
  return { pass: findings.length === 0, findings };
}
