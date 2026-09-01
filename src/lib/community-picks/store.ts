import { isDatabaseConfigured, query } from "@/lib/db";
import { computeReturnPct } from "@/lib/competitions/scores";
import { listSeedCanonicalCommunities } from "@/lib/groups/seed-groups";
import { getPrimaryGroupForUser } from "@/lib/groups/store";
import { fetchStockQuotes } from "@/lib/market/quotes";
import type {
  CommunityPick,
  CommunityPickGroup,
  CommunityPicksPayload,
  CommunityStanding,
} from "@/lib/community-picks/types";

type PickRow = {
  user_id: string;
  group_id: string;
  ticker: string;
  entry_price: string;
  picked_at: Date;
};

type GroupRow = {
  id: string;
  name: string;
  primary_color: string | null;
};

function livePrice(
  quote: Awaited<ReturnType<typeof fetchStockQuotes>>[number] | undefined,
): number | null {
  return quote?.price ?? quote?.previousClose ?? null;
}

function groupPayload(group: GroupRow): CommunityPickGroup {
  return {
    groupId: group.id,
    name: group.name,
    primaryColor: group.primary_color,
  };
}

export async function setCommunityPick(input: {
  userId: string;
  groupId: string;
  ticker: string;
  entryPrice: number;
}): Promise<void> {
  if (!isDatabaseConfigured()) throw new Error("Database required to save community picks.");
  await query(
    `insert into community_picks (user_id, group_id, ticker, entry_price)
     values ($1, $2, $3, $4)
     on conflict (user_id) do update set
       group_id = excluded.group_id,
       ticker = excluded.ticker,
       entry_price = excluded.entry_price,
       picked_at = now(),
       updated_at = now()
     where community_picks.group_id <> excluded.group_id
        or community_picks.ticker <> excluded.ticker`,
    [input.userId, input.groupId, input.ticker.toUpperCase(), input.entryPrice],
  );
}

export async function loadCommunityPicks(userId?: string): Promise<CommunityPicksPayload> {
  if (!isDatabaseConfigured()) {
    return {
      authenticated: Boolean(userId),
      viewerGroup: null,
      viewerPick: null,
      standings: listSeedCanonicalCommunities().map((group) => ({
        groupId: group.id,
        name: group.name,
        primaryColor: group.primaryColor,
        pickCount: 0,
        avgReturnPct: null,
      })),
    };
  }

  const [pickResult, groupResult, primaryGroup] = await Promise.all([
    query<PickRow>(
      `select user_id, group_id, ticker, entry_price, picked_at
       from community_picks
       order by picked_at asc`,
    ),
    query<GroupRow>(
      `select g.id, g.name, g.primary_color
       from groups g
       where exists (
         select 1 from user_group_memberships m where m.group_id = g.id
       ) or exists (
         select 1 from community_picks p where p.group_id = g.id
       )
       order by g.name asc`,
    ),
    userId ? getPrimaryGroupForUser(userId) : Promise.resolve(null),
  ]);

  const tickers = [...new Set(pickResult.rows.map((row) => row.ticker.toUpperCase()))];
  const quotes = await fetchStockQuotes(tickers);
  const quoteByTicker = new Map(quotes.map((quote) => [quote.ticker.toUpperCase(), quote]));
  const returnsByGroup = new Map<string, number[]>();

  let viewerPick: CommunityPick | null = null;
  for (const row of pickResult.rows) {
    const ticker = row.ticker.toUpperCase();
    const entryPrice = Number(row.entry_price);
    const currentPrice = livePrice(quoteByTicker.get(ticker));
    const returnPct = currentPrice === null ? null : computeReturnPct(entryPrice, currentPrice);
    if (returnPct !== null) {
      const returns = returnsByGroup.get(row.group_id) ?? [];
      returns.push(returnPct);
      returnsByGroup.set(row.group_id, returns);
    }
    if (userId && row.user_id === userId) {
      viewerPick = {
        ticker,
        entryPrice,
        currentPrice,
        returnPct,
        pickedAt: row.picked_at.toISOString(),
      };
    }
  }

  const pickCounts = new Map<string, number>();
  for (const row of pickResult.rows) {
    pickCounts.set(row.group_id, (pickCounts.get(row.group_id) ?? 0) + 1);
  }

  const groups = groupResult.rows.slice();
  if (primaryGroup && !groups.some((group) => group.id === primaryGroup.id)) {
    groups.push({
      id: primaryGroup.id,
      name: primaryGroup.name,
      primary_color: primaryGroup.primaryColor,
    });
  }

  const standings: CommunityStanding[] = groups
    .map((group) => {
      const returns = returnsByGroup.get(group.id) ?? [];
      const avgReturnPct = returns.length > 0
        ? Math.round((returns.reduce((sum, value) => sum + value, 0) / returns.length) * 100) / 100
        : null;
      return {
        ...groupPayload(group),
        pickCount: pickCounts.get(group.id) ?? 0,
        avgReturnPct,
      };
    })
    .sort((a, b) => {
      if (a.avgReturnPct === null && b.avgReturnPct !== null) return 1;
      if (a.avgReturnPct !== null && b.avgReturnPct === null) return -1;
      if (a.avgReturnPct !== b.avgReturnPct) return (b.avgReturnPct ?? 0) - (a.avgReturnPct ?? 0);
      if (a.pickCount !== b.pickCount) return b.pickCount - a.pickCount;
      return a.name.localeCompare(b.name);
    });

  return {
    authenticated: Boolean(userId),
    viewerGroup: primaryGroup
      ? {
          groupId: primaryGroup.id,
          name: primaryGroup.name,
          primaryColor: primaryGroup.primaryColor,
        }
      : null,
    viewerPick,
    standings,
  };
}
