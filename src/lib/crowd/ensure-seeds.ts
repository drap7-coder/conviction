import { getPool, isDatabaseConfigured, query } from "@/lib/db";
import {
  CROWD_SEED_BOOKS,
  CROWD_SEED_ID_PREFIX,
  CROWD_SEED_WATCHLIST_META,
  crowdSeedEmail,
} from "@/lib/crowd/seed-books";

/**
 * Full upsert of the ten Crowd starter books into Neon.
 * Use from ops/scripts (`npm run seed:crowd`) or when seeds are missing.
 * Do not call on every Crowd GET — prefer {@link ensureCrowdSeedBooksIfNeeded}.
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

/**
 * Read-path guard: only rewrite demo books when they are missing.
 * Avoids ~100 delete/insert writes on every Crowd GET once seeds exist.
 */
export async function ensureCrowdSeedBooksIfNeeded(): Promise<{
  seeded: boolean;
  bookCount: number;
  skipped: boolean;
}> {
  if (!isDatabaseConfigured()) {
    return { seeded: false, bookCount: CROWD_SEED_BOOKS.length, skipped: true };
  }

  const seedIds = CROWD_SEED_BOOKS.map((book) => book.id);
  const users = await query<{ count: string }>(
    `select count(*)::text as count from users where id = any($1::text[])`,
    [seedIds],
  );
  const userCount = Number(users.rows[0]?.count ?? 0);
  if (userCount < seedIds.length) {
    const result = await ensureCrowdSeedBooks();
    return { ...result, skipped: false };
  }

  const positions = await query<{ count: string }>(
    `select count(*)::text as count
     from portfolio_positions
     where user_id = any($1::text[])`,
    [seedIds],
  );
  const positionCount = Number(positions.rows[0]?.count ?? 0);
  if (positionCount === 0) {
    const result = await ensureCrowdSeedBooks();
    return { ...result, skipped: false };
  }

  return { seeded: false, bookCount: userCount, skipped: true };
}
