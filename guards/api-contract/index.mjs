// No node imports here: this file also runs in a browser. It compares each changed OpenAPI or Swagger spec with
// its version on the base branch (`readBase`), so it needs a pull request; on a push scan it passes.
// It reports only changes that break a client already written against the old spec, and skips a spec it
// cannot read rather than guess.
import { parseYaml } from "../../lib/yaml-lite.mjs";

export const name = "api-contract";
const METHODS = ["get", "put", "post", "delete", "patch", "options", "head", "trace"];
const SPEC_EXT = /\.(json|ya?ml)$/i;
const SPEC_HEAD = /^\s*["']?(openapi|swagger)["']?\s*:/m;

function parse(file, text) {
  if (text == null || !SPEC_HEAD.test(text)) return null;
  try {
    const doc = /\.json$/i.test(file) ? JSON.parse(text) : parseYaml(text);
    return doc && typeof doc === "object" && doc.paths && typeof doc.paths === "object" ? doc : null;
  } catch { return null; }
}

// Local $ref only (#/components/... or #/parameters/...); anything else stays as it is.
function deref(doc, node) {
  for (let n = 0; node && typeof node.$ref === "string" && node.$ref.startsWith("#/") && n < 10; n++) {
    node = node.$ref.slice(2).split("/").reduce((o, k) => (o == null ? o : o[k.replace(/~1/g, "/").replace(/~0/g, "~")]), doc);
  }
  return node ?? {};
}

function params(doc, pathItem, op) {
  const out = new Map();
  for (const p of [...(pathItem.parameters ?? []), ...(op.parameters ?? [])]) {
    const r = deref(doc, p);
    if (r.name && r.in) out.set(`${r.in}:${r.name}`, r);
  }
  return out;
}

const lineOf = (text, needle) => {
  const at = (text ?? "").indexOf(needle);
  return at < 0 ? 1 : text.slice(0, at).split("\n").length;
};

export function diffSpecs(base, head) {
  const breaks = [];
  for (const [path, baseItem] of Object.entries(base.paths)) {
    const headItem = head.paths[path];
    if (!headItem) { breaks.push({ at: path, message: `endpoint ${path} was removed` }); continue; }
    const bi = deref(base, baseItem), hi = deref(head, headItem);
    for (const m of METHODS) {
      if (!bi[m]) continue;
      const op = `${m.toUpperCase()} ${path}`;
      if (!hi[m]) { breaks.push({ at: path, message: `${op} was removed` }); continue; }
      const bp = params(base, bi, bi[m]), hp = params(head, hi, hi[m]);
      for (const [key, p] of hp) {
        const before = bp.get(key);
        if (p.required && !before) breaks.push({ at: path, message: `${op} has a new required ${p.in} parameter "${p.name}"` });
        else if (p.required && before && !before.required) breaks.push({ at: path, message: `${op} now requires ${p.in} parameter "${p.name}"` });
      }
      for (const [key, p] of bp) if (!hp.has(key) && p.in === "path") breaks.push({ at: path, message: `${op} lost path parameter "${p.name}"` });
      const bb = deref(base, bi[m].requestBody), hb = deref(head, hi[m].requestBody);
      if (hb.required && !bb.required) breaks.push({ at: path, message: `${op} now requires a request body` });
      const codes = (o) => Object.keys(o.responses ?? {}).filter((c) => /^2\d\d$|^2XX$/i.test(c));
      const headCodes = new Set(codes(hi[m]));
      for (const c of codes(bi[m])) if (!headCodes.has(c)) breaks.push({ at: path, message: `${op} no longer returns ${c}` });
    }
  }
  return breaks;
}

export function run({ files, changes, read, readBase }) {
  const findings = [];
  if (!readBase || !changes) return { pass: true, findings };
  for (const c of changes) {
    const was = c.from ?? c.file;
    if (c.status === "A" || !SPEC_EXT.test(was)) continue;
    const base = parse(was, readBase(was));
    if (!base) continue;
    if (c.status === "D") { findings.push({ file: was, line: 1, message: `API spec was deleted (${Object.keys(base.paths).length} endpoint${Object.keys(base.paths).length === 1 ? "" : "s"})` }); continue; }
    if (files && !files.includes(c.file)) continue;
    const text = read(c.file);
    const head = parse(c.file, text);
    if (!head) continue;
    for (const b of diffSpecs(base, head)) findings.push({ file: c.file, line: lineOf(text, b.at), message: `breaking API change: ${b.message}` });
  }
  return { pass: findings.length === 0, findings };
}
