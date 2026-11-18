import { readText, isTestPath } from "../../lib/fs.mjs";

export const name = "public-env-secrets";

// Bundlers copy every variable with one of these prefixes into the JavaScript each visitor downloads (Vite VITE_,
// Next NEXT_PUBLIC_, Create React App REACT_APP_, Nuxt NUXT_PUBLIC_, Expo EXPO_PUBLIC_, Astro and SvelteKit PUBLIC_).
// A secret behind one of them is public, even when .env is git-ignored and the host never serves it.
const PUBLIC_VAR = /\b(?:VITE|NEXT_PUBLIC|REACT_APP|NUXT_PUBLIC|EXPO_PUBLIC|PUBLIC)_[A-Z][A-Z0-9_]*/g;
const PREFIX = /^(?:VITE|NEXT_PUBLIC|REACT_APP|NUXT_PUBLIC|EXPO_PUBLIC|PUBLIC)_/;

// Names that say "this is a secret", or a paid API vendor followed by KEY or TOKEN.
const SECRET_NAME = /SECRET|PRIVATE|PASSWORD|PASSWD|SERVICE_ROLE|ADMIN_(?:KEY|TOKEN)|(?:OPENAI|ANTHROPIC|CLAUDE|GEMINI|GROQ|MISTRAL|COHERE|REPLICATE|RESEND|SENDGRID|MAILGUN|POSTMARK|TWILIO|STRIPE|AWS|GITHUB|GITLAB|SLACK|OPENROUTER|PERPLEXITY|ELEVENLABS|DEEPSEEK|XAI)[A-Z0-9_]*(?:KEY|TOKEN)\b/;
// Names that are public by design (publishable and anon keys, ids, limits).
const PUBLIC_BY_DESIGN = /PUBLISHABLE|ANON|PUBLIC_KEY|PUBKEY|SITE_KEY|CLIENT_ID|APP_ID|PROJECT_ID|MEASUREMENT_ID|MIN_LENGTH|MAX_LENGTH|_LENGTH$|_URL$/;

const isSecretName = (n) => { const rest = n.replace(PREFIX, ""); return SECRET_NAME.test(rest) && !PUBLIC_BY_DESIGN.test(rest); };
// Docs and changelogs warn about these names; they are not usage.
const SKIP_FILE = /\.(md|mdx|txt|rst|lock|svg|png|jpe?g|gif|ico|woff2?)$/i;

// ctx.files: files to scan (the changed files, or all of them).
export function run({ root, files }) {
  const findings = [];
  for (const f of files) {
    if (isTestPath(f) || SKIP_FILE.test(f)) continue;
    const text = readText(root, f);
    if (text === null) continue;
    text.split("\n").forEach((line, i) => {
      const seen = new Set();
      for (const m of line.matchAll(PUBLIC_VAR)) {
        const v = m[0];
        if (seen.has(v) || !isSecretName(v)) continue;
        seen.add(v);
        findings.push({ file: f, line: i + 1, message: `${v} is shipped to every visitor's browser (rotate the key if it was ever deployed; call the vendor from a server or edge function and keep the key in a server-only variable)` });
      }
    });
  }
  return { pass: findings.length === 0, findings };
}
