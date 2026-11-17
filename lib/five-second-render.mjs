// `gel five-second`: open a page in headless Chrome at a phone size, let its scripts draw it, and keep the first screen
// (the headline and what follows it) so the five-second-test guard can judge a page whose source has no headline.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const CHROMES = [process.env.CHROME, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "google-chrome", "google-chrome-stable", "chromium", "chromium-browser"].filter(Boolean);

export function firstScreen(dom) {
  const h1 = /<h1\b[^>]*>[\s\S]*?<\/h1>/i.exec(dom);
  if (!h1) return "";
  return dom.slice(h1.index, h1.index + h1[0].length + 2600);
}

export function measure({ url, file, size = "375x812", budgetMs = 8000 }) {
  const target = url ?? pathToFileURL(resolve(file)).href;
  const [w, h] = size.split("x").map(Number);
  const chrome = CHROMES.find((c) => c.includes("/") ? existsSync(c) : spawnSync("which", [c]).status === 0);
  if (!chrome) throw new Error("no Chrome found: install Google Chrome or set CHROME=/path/to/chrome");
  const r = spawnSync(chrome, ["--headless=new", "--disable-gpu", "--no-sandbox", `--window-size=${w},${h}`, `--virtual-time-budget=${budgetMs}`, "--dump-dom", target], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: budgetMs + 30000 });
  if (r.status !== 0 && !r.stdout) throw new Error(`Chrome failed for ${target}: ${(r.stderr ?? "").slice(-300)}`);
  return { page: url ?? file, width: w, height: h, html: firstScreen(r.stdout ?? "") };
}
