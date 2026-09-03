import { getPool, isDatabaseConfigured, query } from "@/lib/db";
import {
  CAMPUS_SEED_ID_PREFIX,
  CAMPUS_SEED_STUDENTS_PER_SCHOOL,
  campusSeedEmail,
  listCampusSeedStudents,
} from "@/lib/community-picks/seed-students";
import { ensureSeedGroups } from "@/lib/groups/store";
import { pricingSymbolForStored } from "@/lib/community-picks/asset-maps";
import { CALLS_REQUIRED, type CallSlot } from "@/lib/community-picks/call-slots";
import { PLAYER_BANKROLL_USD } from "@/lib/community-picks/notional";

const PICK_UNIVERSE_SECOND = [
  { ticker: "JPM", entryPrice: 195 },
  { ticker: "XOM", entryPrice: 108 },
  { ticker: "JNJ", entryPrice: 152 },
  { ticker: "COST", entryPrice: 780 },
  { ticker: "VTI", entryPrice: 255 },
] as const;

const PICK_UNIVERSE_THIRD = [
  { ticker: "AMD", entryPrice: 122 },
  { ticker: "AVGO", entryPrice: 145 },
  { ticker: "TSLA", entryPrice: 240 },
  { ticker: "QQQ", entryPrice: 460 },
  { ticker: "META", entryPrice: 490 },
] as const;

const INTL_SEED_IDS = ["INDIA", "CHINA", "JAPAN", "EUROPE", "UK", "EMERGING"] as const;

/**
 * Upsert 5 demo students × each seeded school into memberships + community_picks.
 * Ops: `npm run seed:campus`. Prefer {@link ensureCampusPickSeedsIfNeeded} on read.
 */
export async function ensureCampusPickSeeds(): Promise<{
  seeded: boolean;
  studentCount: number;
  schoolCount: number;
}> {
  const students = listCampusSeedStudents();
  const schoolCount = new Set(students.map((row) => row.groupId)).size;

  if (!isDatabaseConfigured()) {
    return { seeded: false, studentCount: students.length, schoolCount };
  }

  await ensureSeedGroups();

  const client = await getPool().connect();
  try {
    await client.query("begin");

    for (const [index, student] of students.entries()) {
      const seat = index % CAMPUS_SEED_STUDENTS_PER_SCHOOL;

      await client.query(
        `insert into users (id, name, email)
         values ($1, $2, $3)
         on conflict (id) do update set name = excluded.name`,
        [student.id, student.label, campusSeedEmail(student.id)],
      );

      await client.query(
        `insert into user_institution_memberships (user_id, institution_id)
         values ($1, $2)
         on conflict (user_id, institution_id) do nothing`,
        [student.id, student.institutionId],
      );

      await client.query(
        `insert into user_group_memberships (user_id, group_id, is_primary)
         values ($1, $2, true)
         on conflict (user_id, group_id) do update set is_primary = true`,
        [student.id, student.groupId],
      );

      await client.query(
        `insert into community_picks (
           user_id, group_id, call_slot, ticker, entry_price, banked_growth_factor, picked_at, updated_at
         ) values ($1, $2, 'STOCK_1', $3, $4, $5, now(), now())
         on conflict (user_id, group_id, call_slot) do update set
           ticker = excluded.ticker,
           entry_price = excluded.entry_price,
           banked_growth_factor = excluded.banked_growth_factor,
           updated_at = now()`,
        [
          student.id,
          student.groupId,
          student.ticker,
          student.entryPrice,
          student.bankedGrowthFactor,
        ],
      );

      // Complete the five-call board so seed campuses stay leaderboard-eligible.
      const stock2 = PICK_UNIVERSE_SECOND[seat % PICK_UNIVERSE_SECOND.length]!;
      const stock3 = PICK_UNIVERSE_THIRD[seat % PICK_UNIVERSE_THIRD.length]!;
      const macroBtcGold = seat % 2 === 0 ? "BITCOIN" : "GOLD";
      const macroIntl = INTL_SEED_IDS[seat % INTL_SEED_IDS.length]!;
      const extras: Array<{ slot: string; ticker: string; entry: number }> = [
        { slot: "STOCK_2", ticker: stock2.ticker, entry: stock2.entryPrice },
        { slot: "STOCK_3", ticker: stock3.ticker, entry: stock3.entryPrice },
        { slot: "BTC_GOLD", ticker: macroBtcGold, entry: seat % 2 === 0 ? 65000 : 220 },
        { slot: "INTERNATIONAL", ticker: macroIntl, entry: 50 },
      ];
      for (const extra of extras) {
        if (extra.ticker === student.ticker) continue;
        await client.query(
          `insert into community_picks (
             user_id, group_id, call_slot, ticker, entry_price, banked_growth_factor, picked_at, updated_at
           ) values ($1, $2, $3, $4, $5, 1.0, now(), now())
           on conflict (user_id, group_id, call_slot) do update set
             ticker = excluded.ticker,
             entry_price = excluded.entry_price,
             updated_at = now()`,
          [student.id, student.groupId, extra.slot, extra.ticker, extra.entry],
        );
      }

      /**
       * Seed an "active portfolio" for each seeded campus member so Portfolio pages
       * show a credible changing book for demo/testing.
       *
       * Portfolio holdings are derived from the same five-call assets stored in
       * `community_picks` (mapped through `pricingSymbolForStored`).
       */
      await client.query(`delete from portfolio_positions where user_id = $1`, [student.id]);

      const legs = await client.query<{
        call_slot: CallSlot;
        ticker: string;
        entry_price: number;
      }>(
        `select call_slot, ticker, entry_price
         from community_picks
         where user_id = $1 and group_id = $2`,
        [student.id, student.groupId],
      );

      const perLegNotional = PLAYER_BANKROLL_USD / CALLS_REQUIRED;
      const byTicker = new Map<string, { shares: number; cost: number }>();

      for (const leg of legs.rows) {
        const ticker = pricingSymbolForStored(leg.call_slot, leg.ticker);
        const entry = Number(leg.entry_price);
        if (!Number.isFinite(entry) || entry <= 0) continue;
        const shares = perLegNotional / entry;

        const current = byTicker.get(ticker) ?? { shares: 0, cost: 0 };
        byTicker.set(ticker, { shares: current.shares + shares, cost: current.cost + perLegNotional });
      }

      for (const [ticker, pos] of byTicker.entries()) {
        const average_cost = pos.cost / pos.shares;
        await client.query(
          `insert into portfolio_positions (user_id, ticker, shares, average_cost, note)
           values ($1, $2, $3, $4, '')
           on conflict (user_id, ticker) do update set
             shares = excluded.shares,
             average_cost = excluded.average_cost,
             note = excluded.note,
             updated_at = now()`,
          [student.id, ticker, pos.shares, average_cost],
        );
      }
    }

    await client.query("commit");
    return { seeded: true, studentCount: students.length, schoolCount };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function countCampusSeedUsersInDb(): Promise<number> {
  if (!isDatabaseConfigured()) return 0;
  const result = await query<{ count: string }>(
    `select count(*)::text as count from users where id like $1`,
    [`${CAMPUS_SEED_ID_PREFIX}%`],
  );
  return Number(result.rows[0]?.count ?? 0);
}

/**
 * Read-path guard: only rewrite campus seeds when missing.
 * Avoids rewriting 75 rows on every Community standings GET.
 */
export async function ensureCampusPickSeedsIfNeeded(): Promise<{
  seeded: boolean;
  studentCount: number;
  schoolCount: number;
  skipped: boolean;
}> {
  const students = listCampusSeedStudents();
  const schoolCount = new Set(students.map((row) => row.groupId)).size;

  if (!isDatabaseConfigured()) {
    return { seeded: false, studentCount: students.length, schoolCount, skipped: true };
  }

  const seedIds = students.map((row) => row.id);
  const users = await query<{ count: string }>(
    `select count(*)::text as count from users where id = any($1::text[])`,
    [seedIds],
  );
  const userCount = Number(users.rows[0]?.count ?? 0);
  if (userCount < seedIds.length) {
    const result = await ensureCampusPickSeeds();
    return { ...result, skipped: false };
  }

  const picks = await query<{ count: string }>(
    `select count(*)::text as count
     from community_picks
     where user_id = any($1::text[])`,
    [seedIds],
  );
  const pickCount = Number(picks.rows[0]?.count ?? 0);
  if (pickCount < seedIds.length) {
    const result = await ensureCampusPickSeeds();
    return { ...result, skipped: false };
  }

  // Also ensure seeded users have portfolio_positions so Portfolio shows changes.
  const portfolios = await query<{ count: string }>(
    `select count(distinct user_id)::text as count
     from portfolio_positions
     where user_id = any($1::text[])`,
    [seedIds],
  );
  const portfolioUserCount = Number(portfolios.rows[0]?.count ?? 0);
  if (portfolioUserCount < seedIds.length) {
    const result = await ensureCampusPickSeeds();
    return { ...result, skipped: false };
  }

  return { seeded: false, studentCount: userCount, schoolCount, skipped: true };
}
