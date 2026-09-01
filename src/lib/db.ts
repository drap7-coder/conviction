import { Pool, type PoolClient, type QueryResultRow } from "@neondatabase/serverless";

let pool: Pool | null = null;

export type DbQuery = <T extends QueryResultRow = QueryResultRow>(
  text: string,
  values?: unknown[],
) => Promise<{ rows: T[]; rowCount: number | null }>;

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for Neon-backed user watchlists");
  }
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
) {
  const result = await getPool().query<T>(text, values);
  return result;
}

/** Run queries in a single transaction; rolls back on failure. */
export async function withTransaction<T>(fn: (queryTx: DbQuery) => Promise<T>): Promise<T> {
  const client: PoolClient = await getPool().connect();
  const queryTx: DbQuery = async (text, values = []) => client.query(text, values);

  try {
    await client.query("BEGIN");
    const result = await fn(queryTx);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
