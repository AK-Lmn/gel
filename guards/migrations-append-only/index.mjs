// No node imports here: this file also runs in a browser. It needs the pull request's changes against its base
// (`changes`, from lib/diff.mjs or a case's "base" files). Without them (a push scan, a browser) it passes.
export const name = "migrations-append-only";

// Folders that hold database migrations in common frameworks: Rails, Django, Alembic, Prisma, Knex, Sequelize,
// TypeORM, Drizzle, Supabase, Flyway, golang-migrate, goose, Diesel, sqlx.
const DIR = /(^|\/)(migrations?|migrate|alembic\/versions|db\/migration)\//i;
const CODE = /\.(sql|py|rb|js|mjs|cjs|ts|go|rs)$/i;
// Files in those folders that tools rewrite on every new migration, or that are not migrations.
const NOT_MIGRATION = /(^|\/)(__init__\.py|meta\/[^/]+|_journal\.json|migration_lock\.toml|schema\.rb|structure\.sql|[^/]*\.(test|spec)\.[a-z]+|README[^/]*)$/i;

export const isMigration = (f) => DIR.test(f) && CODE.test(f) && !NOT_MIGRATION.test(f);

export function run({ changes }) {
  const findings = [];
  for (const c of changes ?? []) {
    const old = c.from ?? c.file;
    if (c.status === "A" || !isMigration(old)) continue;
    const what = c.status === "D" ? "deleted" : c.status === "R" ? `renamed to ${c.file}` : "edited";
    findings.push({ file: old, line: 1, message: `migration already on the base branch was ${what}; add a new migration instead, since databases that ran the old one never run it again` });
  }
  return { pass: findings.length === 0, findings };
}
