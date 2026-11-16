import { test } from "node:test";
import assert from "node:assert/strict";
import { compare } from "../bench/check.mjs";

const base = { caught: { secret: { caught: 150, n: 150 } }, clean: { "secret-scan": 0 } };
test("same numbers pass the ratchet", () => assert.deepEqual(compare(base, base), []));
test("one fewer planted key caught fails", () => {
  assert.equal(compare(base, { caught: { secret: { caught: 149, n: 150 } }, clean: { "secret-scan": 0 } }).length, 1);
});
test("a new false alarm on clean repos fails", () => {
  assert.match(compare(base, { caught: { secret: { caught: 150, n: 150 } }, clean: { "secret-scan": 1 } })[0], /secret-scan/);
});
test("a kind missing from the results fails", () => assert.match(compare(base, { caught: {}, clean: {} })[0], /missing/));
