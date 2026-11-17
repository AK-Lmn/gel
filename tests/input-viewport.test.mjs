import { test } from "node:test";
import assert from "node:assert/strict";
import { instrument, parseDump } from "../lib/input-viewport.mjs";

test("instrument adds a base and the measuring script", () => {
  const out = instrument("<html><head></head><body><textarea></textarea></body></html>", "https://x.test/");
  assert.match(out, /<head><base href="https:\/\/x.test\/">/);
  assert.match(out, /gel-input-viewport[\s\S]*<\/script><\/body>/);
});
test("parseDump reads the measurement from the dumped DOM", () => {
  const dom = '<body><pre id="gel-input-viewport">{&quot;width&quot;:375,&quot;height&quot;:667,&quot;top&quot;:400,&quot;bottom&quot;:460}</pre></body>';
  assert.deepEqual(parseDump(dom), { width: 375, height: 667, top: 400, bottom: 460 });
  assert.equal(parseDump("<body></body>"), null);
});
