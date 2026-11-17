import { readText } from "../../lib/fs.mjs";

export const name = "five-second-test";
// A stranger on a phone decides in five seconds whether a project is alive and for them. This guard reads the
// first screen of each landing page (offline, no browser) and fails when that screen cannot be understood in
// five seconds: no headline, a headline that is a paragraph, a lead full of jargon, or no button to press.
// Tune in gel.json: "five_second": { "pages": [...], "max_h1_words": 12, "max_lead_words": 32, "jargon": [...] }.
const PAGES = ["index.html", "public/index.html", "docs/index.html", "site/index.html"];
const JARGON = ["pods?", "orchestrat\\w*", "endpoints?", "openai-compatible", "inference", "mcp", "llms?", "sdks?", "serverless", "runtimes?", "kubernetes", "k8s", "namespaces?", "tensors?", "latency", "throughput", "rag", "embeddings?", "checkpoints?", "middleware", "idempotent", "daemons?", "multi-tenant", "control plane"];
const text = (html) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const words = (s) => (s.match(/\S+/g) ?? []).length;

export function run({ root, files, cfg }) {
  const c = cfg?.five_second ?? {};
  const pages = (c.pages ?? PAGES).filter((p) => files.includes(p));
  const jargon = new RegExp(`\\b(?:${(c.jargon ?? JARGON).join("|")})\\b`, "i");
  const maxH1 = c.max_h1_words ?? 12;
  const maxLead = c.max_lead_words ?? 32;
  const findings = [];
  for (const f of pages) {
    const html = readText(root, f);
    if (html === null) continue;
    const at = (message) => findings.push({ file: f, line: 1, message: `five-second test: ${message}` });
    const h1 = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
    if (!h1) { at("no <h1>: a visitor has nothing to read first"); continue; }
    const head = text(h1[1]);
    if (!head) { at("the <h1> is empty"); continue; }
    if (words(head) > maxH1) at(`the headline is ${words(head)} words (max ${maxH1}): say what it is in one short line`);
    if (jargon.test(head)) at(`the headline uses jargon ("${jargon.exec(head)[0]}"): say what it does for a person`);
    const after = html.slice(h1.index + h1[0].length);
    const p = /<p\b[^>]*>([\s\S]*?)<\/p>/i.exec(after);
    const lead = p ? text(p[1]) : "";
    if (!lead) at("no sentence under the headline saying who it is for and what they get");
    else {
      if (words(lead) > maxLead) at(`the first sentence block is ${words(lead)} words (max ${maxLead}): cut it`);
      if (jargon.test(lead)) at(`the lead uses jargon ("${jargon.exec(lead)[0]}"): use plain words`);
    }
    if (!/<(?:a|button)\b[^>]*>/i.test(after.slice(0, 2500))) at("no link or button right under the headline: tell the visitor what to do next");
  }
  return { pass: findings.length === 0, findings };
}
