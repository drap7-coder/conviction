import { isDatabaseConfigured, query } from "@/lib/db";
import { fetchStockQuotes } from "@/lib/market/quotes";
import { computeReturnPct } from "@/lib/competitions/scores";
import { weekWindowContaining } from "@/lib/competitions/schedule";
import { ensureWeeklyCompetitions } from "@/lib/competitions/store";

type PickRow = {
  id: string;
  ticker: string;
  start_price: string | null;
};

type CompetitionRow = {
  id: string;
  group_a_id: string;
  group_b_id: string;
  period_start: Date;
  period_end: Date;
  status: string;
  locked_at: Date | null;
};

function sessionOpenPrice(quote: Awaited<ReturnType<typeof fetchStockQuotes>>[number]): number | null {
  return quote.price ?? quote.previousClose ?? null;
}

export async function lockDueCompetitions(now = new Date()): Promise<number> {
  if (!isDatabaseConfigured()) return 0;
  await ensureWeeklyCompetitions(now);
  const open = await query<CompetitionRow>(
    `select id, group_a_id, group_b_id, period_start, period_end, status, locked_at
     from competitions where status = 'open'`,
  );
  let locked = 0;
  for (const comp of open.rows) {
    const window = weekWindowContaining(comp.period_start);
    const lockAt = comp.locked_at ?? window.lockAt;
    if (now < lockAt) continue;

    const picks = await query<PickRow>(
      `select id, ticker, start_price from competition_picks where competition_id = $1`,
      [comp.id],
    );
    if (picks.rows.length === 0) {
      await query(
        `update competitions set status = 'live', locked_at = $2 where id = $1`,
        [comp.id, lockAt],
      );
      locked += 1;
      continue;
    }

    const tickers = [...new Set(picks.rows.map((row) => row.ticker.toUpperCase()))];
    const quotes = await fetchStockQuotes(tickers);
    const byTicker = new Map(quotes.map((q) => [q.ticker.toUpperCase(), q]));

    for (const pick of picks.rows) {
      const quote = byTicker.get(pick.ticker.toUpperCase());
      const startPrice = quote ? sessionOpenPrice(quote) : null;
      if (startPrice === null) continue;
      await query(
        `update competition_picks set
           start_price = $2,
           current_price = $2,
           return_pct = 0,
           locked_at = $3
         where id = $1`,
        [pick.id, startPrice, lockAt],
      );
    }

    await query(
      `update competitions set status = 'live', locked_at = $2 where id = $1`,
      [comp.id, lockAt],
    );
    locked += 1;
  }
  return locked;
}

export async function syncLiveCompetitions(): Promise<number> {
  if (!isDatabaseConfigured()) return 0;
  const live = await query<{ id: string }>(
    `select id from competitions where status = 'live'`,
  );
  let updated = 0;
  for (const comp of live.rows) {
    const picks = await query<PickRow>(
      `select id, ticker, start_price from competition_picks
       where competition_id = $1 and locked_at is not null and start_price is not null`,
      [comp.id],
    );
    if (picks.rows.length === 0) continue;
    const tickers = [...new Set(picks.rows.map((row) => row.ticker.toUpperCase()))];
    const quotes = await fetchStockQuotes(tickers);
    const byTicker = new Map(quotes.map((q) => [q.ticker.toUpperCase(), q]));

    for (const pick of picks.rows) {
      const quote = byTicker.get(pick.ticker.toUpperCase());
      const current = quote ? sessionOpenPrice(quote) : null;
      const start = pick.start_price !== null ? Number(pick.start_price) : null;
      if (current === null || start === null) continue;
      const returnPct = computeReturnPct(start, current);
      await query(
        `update competition_picks set current_price = $2, return_pct = $3 where id = $1`,
        [pick.id, current, returnPct],
      );
      updated += 1;
    }
  }
  return updated;
}

export async function settleDueCompetitions(now = new Date()): Promise<number> {
  if (!isDatabaseConfigured()) return 0;
  const live = await query<CompetitionRow>(
    `select id, group_a_id, group_b_id, period_start, period_end, status, locked_at
     from competitions where status in ('live', 'final')`,
  );
  let settled = 0;
  for (const comp of live.rows) {
    if (now < comp.period_end) continue;

    await syncLiveCompetitions();

    const picks = await query<{
      group_id: string;
      return_pct: string | null;
      current_price: string | null;
      id: string;
    }>(
      `select id, group_id, return_pct, current_price from competition_picks
       where competition_id = $1 and locked_at is not null`,
      [comp.id],
    );

    for (const pick of picks.rows) {
      if (pick.current_price === null) continue;
      await query(
        `update competition_picks set final_price = current_price where id = $1`,
        [pick.id],
      );
    }

    const avg = (groupId: string) => {
      const rows = picks.rows.filter((p) => p.group_id === groupId && p.return_pct !== null);
      if (rows.length === 0) return null;
      const sum = rows.reduce((acc, p) => acc + Number(p.return_pct), 0);
      return sum / rows.length;
    };
    const avgA = avg(comp.group_a_id);
    const avgB = avg(comp.group_b_id);
    let winner: string | null = null;
    if (avgA !== null && avgB !== null) {
      winner = avgA > avgB ? comp.group_a_id : avgB > avgA ? comp.group_b_id : null;
    } else if (avgA !== null) {
      winner = comp.group_a_id;
    } else if (avgB !== null) {
      winner = comp.group_b_id;
    }

    await query(
      `update competitions set status = 'archived', winner_group_id = $2 where id = $1`,
      [comp.id, winner],
    );
    settled += 1;
  }
  return settled;
}

export async function runCompetitionLifecycleTick(now = new Date()): Promise<{
  locked: number;
  synced: number;
  settled: number;
}> {
  const locked = await lockDueCompetitions(now);
  const synced = await syncLiveCompetitions();
  const settled = await settleDueCompetitions(now);
  await ensureWeeklyCompetitions(now);
  return { locked, synced, settled };
}
