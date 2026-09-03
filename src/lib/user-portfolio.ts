import { getPool, isDatabaseConfigured, query } from "@/lib/db";
import type { PersistedPosition } from "@/lib/portfolio/persist";
import { campusSeedLegsForUser } from "@/lib/community-picks/seed-students";
import { CALLS_REQUIRED } from "@/lib/community-picks/call-slots";
import { PLAYER_BANKROLL_USD } from "@/lib/community-picks/notional";
import { pricingSymbolForStored } from "@/lib/community-picks/asset-maps";

const MAX_POSITIONS = 50;

interface UserPortfolioRow {
  [key: string]: unknown;
  ticker: string;
  shares: number;
  average_cost: number | null;
  note: string | null;
}

function rowToPosition(row: UserPortfolioRow): PersistedPosition {
  return {
    ticker: row.ticker,
    shares: Number(row.shares),
    averageCost: row.average_cost === null ? undefined : Number(row.average_cost),
    note: row.note || undefined,
  };
}

export function normalizePortfolioPositions(input: unknown): PersistedPosition[] {
  if (!Array.isArray(input)) return [];
  const positions = new Map<string, PersistedPosition>();

  for (const candidate of input.slice(0, MAX_POSITIONS)) {
    if (!candidate || typeof candidate !== "object") continue;
    const value = candidate as Partial<PersistedPosition>;
    const rawAverageCost = (candidate as Record<string, unknown>).averageCost;
    const ticker = typeof value.ticker === "string" ? value.ticker.trim().toUpperCase() : "";
    const shares = Number(value.shares);
    const averageCost = rawAverageCost === undefined || rawAverageCost === null || rawAverageCost === ""
      ? undefined
      : Number(rawAverageCost);

    if (!/^[A-Z0-9.^-]{1,15}$/.test(ticker)) continue;
    if (!Number.isFinite(shares) || shares <= 0) continue;
    if (averageCost !== undefined && (!Number.isFinite(averageCost) || averageCost <= 0)) continue;

    positions.set(ticker, {
      ticker,
      shares,
      averageCost,
      note: typeof value.note === "string" && value.note.trim()
        ? value.note.trim().slice(0, 1000)
        : undefined,
    });
  }

  return [...positions.values()];
}

export async function getUserPortfolio(userId: string): Promise<PersistedPosition[]> {
  if (!isDatabaseConfigured()) {
    const legs = campusSeedLegsForUser(userId);
    if (!legs) return [];

    // Guest/no-DB mode: synthesize an "active portfolio" for seeded campus members.
    const perLegNotional = PLAYER_BANKROLL_USD / CALLS_REQUIRED;
    const byTicker = new Map<string, { shares: number; cost: number }>();

    for (const leg of legs) {
      const portfolioTicker = pricingSymbolForStored(leg.callSlot, leg.ticker).toUpperCase();
      const entry = Number(leg.entryPrice);
      if (!Number.isFinite(entry) || entry <= 0) continue;

      const shares = perLegNotional / entry;
      const current = byTicker.get(portfolioTicker) ?? { shares: 0, cost: 0 };
      byTicker.set(portfolioTicker, {
        shares: current.shares + shares,
        cost: current.cost + perLegNotional,
      });
    }

    return [...byTicker.entries()].map(([ticker, pos]) => ({
      ticker,
      shares: pos.shares,
      averageCost: pos.cost / pos.shares,
    }));
  }
  const result = await query<UserPortfolioRow>(
    `select ticker, shares, average_cost, note
     from portfolio_positions
     where user_id = $1
     order by created_at asc`,
    [userId],
  );
  return result.rows.map(rowToPosition);
}

export async function replaceUserPortfolio(
  userId: string,
  input: unknown,
): Promise<PersistedPosition[]> {
  if (!isDatabaseConfigured()) return [];
  const positions = normalizePortfolioPositions(input);
  const client = await getPool().connect();

  try {
    await client.query("begin");
    await client.query("delete from portfolio_positions where user_id = $1", [userId]);
    for (const position of positions) {
      await client.query(
        `insert into portfolio_positions (user_id, ticker, shares, average_cost, note)
         values ($1, $2, $3, $4, $5)`,
        [userId, position.ticker, position.shares, position.averageCost ?? null, position.note ?? ""],
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  return getUserPortfolio(userId);
}

export async function migrateUserPortfolio(
  userId: string,
  input: unknown,
): Promise<{ imported: number; positions: PersistedPosition[] }> {
  if (!isDatabaseConfigured()) return { imported: 0, positions: [] };
  const positions = normalizePortfolioPositions(input);
  let imported = 0;

  for (const position of positions) {
    const result = await query(
      `insert into portfolio_positions (user_id, ticker, shares, average_cost, note)
       values ($1, $2, $3, $4, $5)
       on conflict (user_id, ticker) do nothing`,
      [userId, position.ticker, position.shares, position.averageCost ?? null, position.note ?? ""],
    );
    if ((result.rowCount ?? 0) > 0) imported += 1;
  }

  return { imported, positions: await getUserPortfolio(userId) };
}
