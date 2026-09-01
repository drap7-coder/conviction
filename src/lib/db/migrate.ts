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

/** Strip line comments and split on statement terminators. */
function splitSqlStatements(sql: string): string[] {
  const withoutLineComments = sql
    .split("\n")
    .map((line) => {
      const idx = line.indexOf("--");
      return idx >= 0 ? line.slice(0, idx) : line;
    })
    .join("\n");
  return withoutLineComments
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
}
