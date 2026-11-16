import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { pickLane } from "../../lib/lane.mjs";

export const name = "change-risk";
export const owner = "gel";
export const threshold = { min: 0.95 };
const ORDER = ["A", "B", "C"];
const here = dirname(fileURLToPath(import.meta.url));

// Is the lane GEL picks from the changed files the lane a person who read the change would pick?
// A change picked too LOW is a miss and fails the eval outright; too high only costs time.
export function run({ ctx }) {
  const data = ctx.dataset ?? JSON.parse(readFileSync(join(here, "dataset.json"), "utf8"));
  let right = 0;
  const items = [];
  let under = 0;
  for (const d of data) {
    const got = pickLane(d.files, {}).lane;
    if (got === d.lane) right++;
    else {
      const low = ORDER.indexOf(got) < ORDER.indexOf(d.lane);
      if (low) under++;
      items.push({ name: d.name, expected: d.lane, got, kind: low ? "too low" : "too high" });
    }
  }
  const score = data.length ? right / data.length : null;
  return { score, pass: under === 0, detail: `${right} of ${data.length} changes in the right lane, ${under} picked too low`, items };
}
