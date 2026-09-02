import { isDatabaseConfigured, query } from "@/lib/db";
import { fetchStockQuotes } from "@/lib/market/quotes";
import { computeReturnPct } from "@/lib/competitions/scores";
import { weekWindowContaining } from "@/lib/competitions/schedule";

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

/** Lock + price one competition when its Monday window has passed (read-path safe). */
export async function refreshCompetitionScores(
  competitionId: string,
  now = new Date(),
): Promise<void> {
  if (!isDatabaseConfigured() || !competitionId) return;

  const compResult = await query<CompetitionRow>(
    `select id, group_a_id, group_b_id, period_start, period_end, status, locked_at
     from competitions where id = $1 limit 1`,
    [competitionId],
  );
  const comp = compResult.rows[0];
  if (!comp) return;

  const window = weekWindowContaining(comp.period_start);
  const lockAt = comp.locked_at ?? window.lockAt;

  if (comp.status === "open" && now >= lockAt) {
    const picks = await query<PickRow>(
      `select id, ticker, start_price from competition_picks where competition_id = $1`,
      [comp.id],
    );
    if (picks.rows.length > 0) {
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
    }
    await query(
      `update competitions set status = 'live', locked_at = $2 where id = $1`,
      [comp.id, lockAt],
    );
  }

  const liveCheck = await query<{ status: string }>(
    `select status from competitions where id = $1 limit 1`,
    [comp.id],
  );
  if (liveCheck.rows[0]?.status !== "live") return;

  const lockedPicks = await query<PickRow>(
    `select id, ticker, start_price from competition_picks
     where competition_id = $1 and locked_at is not null and start_price is not null`,
    [comp.id],
  );
  if (lockedPicks.rows.length === 0) return;

  const tickers = [...new Set(lockedPicks.rows.map((row) => row.ticker.toUpperCase()))];
  const quotes = await fetchStockQuotes(tickers);
  const byTicker = new Map(quotes.map((q) => [q.ticker.toUpperCase(), q]));

  for (const pick of lockedPicks.rows) {
    const quote = byTicker.get(pick.ticker.toUpperCase());
    const current = quote ? sessionOpenPrice(quote) : null;
    const start = pick.start_price !== null ? Number(pick.start_price) : null;
    if (current === null || start === null) continue;
    const returnPct = computeReturnPct(start, current);
    await query(
      `update competition_picks set current_price = $2, return_pct = $3 where id = $1`,
      [pick.id, current, returnPct],
    );
  }
}
