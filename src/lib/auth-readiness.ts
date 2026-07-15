import { query, isDatabaseConfigured } from "@/lib/db";

export const REQUIRED_AUTH_ENV_VARS = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "AUTH_GITHUB_ID",
  "AUTH_GITHUB_SECRET",
] as const;

export const REQUIRED_AUTH_TABLES = [
  "users",
  "accounts",
  "sessions",
  "verification_token",
  "watchlist_entries",
] as const;

export function isAuthConfigured() {
  return REQUIRED_AUTH_ENV_VARS.every((name) => Boolean(process.env[name]));
}

export function yesNo(value: boolean) {
  return value ? "yes" : "no";
}

export async function checkDatabaseReadiness() {
  if (!isDatabaseConfigured()) {
    return {
      databaseConfigured: false,
      databaseReachable: false,
      requiredTablesPresent: false,
    };
  }

  try {
    const result = await query<{ table_name: string }>(
      `select table_name
       from information_schema.tables
       where table_schema = 'public'
       and table_name = any($1::text[])`,
      [[...REQUIRED_AUTH_TABLES]],
    );
    const present = new Set(result.rows.map((row) => row.table_name));

    return {
      databaseConfigured: true,
      databaseReachable: true,
      requiredTablesPresent: REQUIRED_AUTH_TABLES.every((table) => present.has(table)),
    };
  } catch {
    return {
      databaseConfigured: true,
      databaseReachable: false,
      requiredTablesPresent: false,
    };
  }
}
