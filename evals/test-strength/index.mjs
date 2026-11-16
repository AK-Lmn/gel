import { walk, readText, isTestPath } from "../../lib/fs.mjs";

export const name = "test-strength";
export const owner = "gel";
export const threshold = { min: 0.9 };

const TEST_FILE = /(\.(test|spec)\.[cm]?[jt]sx?$)|((^|\/)test_[^/]+\.py$)|(_test\.(py|go)$)/;
const ASSERT = /\b(assert\w*|expect|should|t\.(is|equal|ok|true|deepEqual)|require\.\w+|self\.assert\w+)\b\s*[.(]|\bassert\s/;
const SKIPPED = /\b(it|test|describe)\.(skip|todo)\b|@pytest\.mark\.skip|\bt\.Skip\(/;
const SOURCE = /\.([cm]?[jt]sx?|py|go|rs)$/;

// A test with no assertion passes whatever the code does. This is a static check, not mutation testing:
// it finds tests that cannot fail, not assertions that are too weak.
export function run({ root }) {
  const files = walk(root);
  const tests = files.filter((f) => TEST_FILE.test(f));
  const sources = files.filter((f) => SOURCE.test(f) && !isTestPath(f));
  if (!tests.length) return sources.length >= 3 ? { score: 0, detail: `no test files for ${sources.length} source files`, items: [{ problem: "no tests" }] } : { score: null, detail: "too little code to need tests" };
  const weak = [];
  for (const f of tests) {
    const text = readText(root, f) ?? "";
    if (!ASSERT.test(text)) weak.push({ file: f, problem: "no assertion" });
    else if (SKIPPED.test(text) && !/skip.{0,40}(because|reason|:)/i.test(text)) weak.push({ file: f, problem: "skipped without a reason" });
  }
  return { score: 1 - weak.length / tests.length, detail: `${tests.length - weak.length} of ${tests.length} test files assert something and run`, items: weak };
}
