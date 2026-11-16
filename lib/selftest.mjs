// Eval of the guards: every guard must tell its labelled good cases from its bad ones, or it is not trusted.
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { GUARD_NAMES, guardDir, loadGuard } from "./guards.mjs";
import { walk } from "./fs.mjs";

export async function selftest() {
  const rows = [];
  for (const n of GUARD_NAMES) {
    const guard = await loadGuard(n);
    const cases = JSON.parse(readFileSync(join(guardDir(n), "cases.json"), "utf8"));
    let caught = 0, bad = 0, falseBlocks = 0, good = 0;
    const wrong = [];
    for (const c of cases) {
      const root = mkdtempSync(join(tmpdir(), "gel-case-"));
      try {
        for (const [p, body] of Object.entries(c.files ?? {})) {
          mkdirSync(dirname(join(root, p)), { recursive: true });
          writeFileSync(join(root, p), Array.isArray(body) ? body.join("") : body);
        }
        const res = await guard.run({ root, files: walk(root), ctx: c.ctx ?? {}, cfg: c.cfg ?? {} });
        if (c.label === "bad") { bad++; res.pass ? wrong.push(`missed: ${c.name}`) : caught++; }
        else { good++; res.pass ? 0 : (falseBlocks++, wrong.push(`false block: ${c.name}`)); }
      } finally { rmSync(root, { recursive: true, force: true }); }
    }
    rows.push({ guard: n, cases: cases.length, good, bad, recall: bad ? caught / bad : 1, precision: caught + falseBlocks ? caught / (caught + falseBlocks) : 1, falseBlocks, wrong, ok: wrong.length === 0 && bad >= 2 && good >= 2 });
  }
  return rows;
}
