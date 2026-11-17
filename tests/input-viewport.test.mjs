import { test } from "node:test";
import assert from "node:assert/strict";
import { instrument, parseDump } from "../lib/input-viewport.mjs";

test("instrument draws the page in a frame of the requested size, with a base", () => {
  const out = instrument('<html><head></head><body><textarea name="a"></textarea></body></html>', "https://x.test/", 320, 568);
  assert.match(out, /<iframe id="f" width="320" height="568"/);
  assert.match(out, /&lt;base|<base href=&quot;https:\/\/x.test\/&quot;>/);
  assert.match(out, /gel-input-viewport/);
});
test("parseDump reads the measurement from the dumped DOM", () => {
  const dom = '<body><pre id="gel-input-viewport">{&quot;width&quot;:375,&quot;height&quot;:667,&quot;top&quot;:400,&quot;bottom&quot;:460}</pre></body>';
  assert.deepEqual(parseDump(dom), { width: 375, height: 667, top: 400, bottom: 460 });
  assert.equal(parseDump("<body></body>"), null);
});
