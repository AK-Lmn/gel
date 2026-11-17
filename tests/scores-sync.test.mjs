// scores.json is the file Cilytics reads (through a CDN) to show each guard's recall and precision.
// It must be what `gel selftest` says right now, so a guard change that moves a score cannot ship a stale file.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { selftest } from "../lib/selftest.mjs";

test("scores.json matches gel selftest (regenerate with: node bin/gel.mjs selftest --json > scores.json)", async () => {
  const published = JSON.parse(readFileSync(new URL("../scores.json", import.meta.url), "utf8"));
  assert.deepEqual(published, JSON.parse(JSON.stringify(await selftest())));
});
