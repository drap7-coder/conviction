import { getPool, isDatabaseConfigured, query } from "@/lib/db";
import {
  CROWD_SEED_BOOKS,
  CROWD_SEED_ID_PREFIX,
  CROWD_SEED_WATCHLIST_META,
  crowdSeedEmail,
} from "@/lib/crowd/seed-books";

/**
 * Idempotent upsert of the ten Crowd starter books into Neon.
 * Safe to call on every Crowd read — conflict paths keep fixtures current.
 */
export async function ensureCrowdSeedBooks(): Promise<{ seeded: boolean; bookCount: number }> {
  if (!isDatabaseConfigured()) {
    return { seeded: false, bookCount: CROWD_SEED_BOOKS.length };
  }

  const client = await getPool().connect();
  try {
    await client.query("begin");

    for (const book of CROWD_SEED_BOOKS) {
      const email = crowdSeedEmail(book.id);
      await client.query(
        `insert into users (id, name, email)
         values ($1, $2, $3)
         on conflict (id) do update set name = excluded.name`,
        [book.id, book.label, email],
      );

      await client.query(`delete from portfolio_positions where user_id = $1`, [book.id]);
      for (const position of book.positions) {
        await client.query(
          `insert into portfolio_positions (user_id, ticker, shares, average_cost, note)
           values ($1, $2, $3, $4, $5)`,
          [
            book.id,
            position.ticker,
            position.shares,
            position.averageCost ?? null,
            position.note ?? "",
          ],
        );
      }

      await client.query(`delete from watchlist_entries where user_id = $1`, [book.id]);
      const watchMeta = CROWD_SEED_WATCHLIST_META[book.id] ?? [];
      for (const entry of watchMeta) {
        await client.query(
          `insert into watchlist_entries (user_id, ticker, company_name, status)
           values ($1, $2, $3, 'active')`,
          [book.id, entry.ticker.toUpperCase(), entry.companyName],
        );
      }
    }

    await client.query("commit");
    return { seeded: true, bookCount: CROWD_SEED_BOOKS.length };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function countCrowdSeedUsersInDb(): Promise<number> {
  if (!isDatabaseConfigured()) return 0;
  const result = await query<{ count: string }>(
    `select count(*)::text as count from users where id like $1`,
    [`${CROWD_SEED_ID_PREFIX}%`],
  );
  return Number(result.rows[0]?.count ?? 0);
}
