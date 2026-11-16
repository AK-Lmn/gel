// What a pull request changed against its base, for guards that compare before and after
// (migrations-append-only, api-contract). Both return null when there is no base to compare with.
import { execFileSync } from "node:child_process";

const git = (root, ...a) => execFileSync("git", a, { cwd: root, encoding: "utf8", maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "ignore"] });

// [{ status: "A"|"M"|"D"|"R", file, from? }]; a rename keeps its old path in `from`.
export function diffChanges(root, base) {
  if (!base || /^0+$/.test(base)) return null;
  try {
    return git(root, "diff", "--name-status", "-M", "-z", `${base}...HEAD`).split("\0").filter(Boolean).reduce((out, tok, i, all) => {
      if (out.skip) { out.skip--; return out; }
      const status = tok[0];
      if (status === "R" || status === "C") { out.list.push({ status: status === "R" ? "R" : "A", from: all[i + 1], file: all[i + 2] }); out.skip = 2; }
      else { out.list.push({ status: "ACMTU".includes(status) && status !== "A" ? "M" : status, file: all[i + 1] }); out.skip = 1; }
      return out;
    }, { list: [], skip: 0 }).list;
  } catch { return null; }
}

// readBase(file): the file's text where this branch left the base, or null.
export function baseReader(root, base) {
  if (!base || /^0+$/.test(base)) return null;
  let mb;
  try { mb = git(root, "merge-base", base, "HEAD").trim(); } catch { return null; }
  return (f) => { try { return git(root, "show", `${mb}:${f}`); } catch { return null; } };
}

// The same two for a labelled case: `base` holds the files before, `files` after.
export function caseDiff(base, files) {
  if (!base) return { changes: null, readBase: null };
  const changes = [];
  for (const f of Object.keys(files ?? {})) if (!(f in base)) changes.push({ status: "A", file: f });
  for (const [f, body] of Object.entries(base)) {
    if (!(f in (files ?? {}))) changes.push({ status: "D", file: f });
    else if (flat(files[f]) !== flat(body)) changes.push({ status: "M", file: f });
  }
  return { changes, readBase: (f) => (f in base ? flat(base[f]) : null) };
}
const flat = (b) => (Array.isArray(b) ? b.join("") : b);
