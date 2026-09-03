import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { isDatabaseConfigured, query } from "@/lib/db";

const MIGRATIONS_DIR = path.join(process.cwd(), "migrations");

/**
 * Apply SQL migrations in lexicographic order (idempotent where statements allow).
 * Tracks applied files in schema_migrations. Requires DATABASE_URL.
 */
export async function applyMigrations(): Promise<{
  applied: string[];
  skipped: string[];
}> {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is required to run migrations.");
  }

  await query(`
    create table if not exists schema_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((name) => name.endsWith(".sql"))
    .sort();

  const appliedRows = await query<{ filename: string }>(
    `select filename from schema_migrations`,
  );
  const already = new Set(appliedRows.rows.map((row) => row.filename));

  const applied: string[] = [];
  const skipped: string[] = [];

  for (const filename of files) {
    if (already.has(filename)) {
      skipped.push(filename);
      continue;
    }
    const sql = await readFile(path.join(MIGRATIONS_DIR, filename), "utf8");
    const statements = splitSqlStatements(sql);
    for (const statement of statements) {
      await query(statement);
    }
    await query(`insert into schema_migrations (filename) values ($1)`, [filename]);
    applied.push(filename);
  }

  return { applied, skipped };
}

/**
 * Strip line comments and split on statement terminators.
 * Respects dollar-quoted bodies (`$$ … $$` / `$tag$ … $tag$`) so DO blocks
 * in migrations are not shredded on internal semicolons.
 */
export function splitSqlStatements(sql: string): string[] {
  // Strip `--` line comments only outside dollar-quoted bodies.
  const withoutLineComments = (() => {
    let out = "";
    let i = 0;
    let dollarTag: string | null = null;
    while (i < sql.length) {
      if (dollarTag) {
        if (sql.startsWith(dollarTag, i)) {
          out += dollarTag;
          i += dollarTag.length;
          dollarTag = null;
          continue;
        }
        out += sql[i]!;
        i += 1;
        continue;
      }
      if (sql[i] === "$") {
        const match = sql.slice(i).match(/^\$[A-Za-z0-9_]*\$/);
        if (match) {
          dollarTag = match[0];
          out += dollarTag;
          i += dollarTag.length;
          continue;
        }
      }
      if (sql[i] === "-" && sql[i + 1] === "-") {
        while (i < sql.length && sql[i] !== "\n") i += 1;
        continue;
      }
      out += sql[i]!;
      i += 1;
    }
    return out;
  })();

  const statements: string[] = [];
  let current = "";
  let i = 0;
  let dollarTag: string | null = null;

  while (i < withoutLineComments.length) {
    const ch = withoutLineComments[i]!;

    if (dollarTag) {
      if (withoutLineComments.startsWith(dollarTag, i)) {
        current += dollarTag;
        i += dollarTag.length;
        dollarTag = null;
        continue;
      }
      current += ch;
      i += 1;
      continue;
    }

    if (ch === "$") {
      const match = withoutLineComments.slice(i).match(/^\$[A-Za-z0-9_]*\$/);
      if (match) {
        dollarTag = match[0];
        current += dollarTag;
        i += dollarTag.length;
        continue;
      }
    }

    if (ch === ";") {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = "";
      i += 1;
      continue;
    }

    current += ch;
    i += 1;
  }

  const trimmed = current.trim();
  if (trimmed) statements.push(trimmed);
  return statements;
}
