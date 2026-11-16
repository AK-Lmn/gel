export const name = "done-without-green";
// "you said all good, checks are failing": a pull request that claims green while a check on its head is red.
// ctx.claim: pull request title and body. ctx.checkRuns: [{ name, conclusion }] on the head commit, without this run.
const CLAIM = /\b(all (?:checks? |tests? |gates? )?(?:green|pass(?:ed|ing)?)|checks? (?:are |is )?(?:green|pass(?:ed|ing)?)|verdict:\s*pass|ready to merge|all good)\b/i;
const RED = new Set(["failure", "timed_out", "cancelled", "action_required"]);

export function run({ ctx = {} }) {
  const claim = ctx.claim ?? "";
  const red = (ctx.checkRuns ?? []).filter((c) => RED.has(c.conclusion));
  if (!CLAIM.test(claim) || red.length === 0) return { pass: true, findings: [] };
  return {
    pass: false,
    findings: red.map((c) => ({ file: "(pull request)", line: 0, message: `claims green, but "${c.name}" is ${c.conclusion}` })),
  };
}
