import { randomUUID } from "node:crypto";
import { isDatabaseConfigured, query, withTransaction, type DbQuery } from "@/lib/db";
import { MIN_RANKED_MEMBERS } from "@/lib/community-picks/constants";
import { ensureCampusPickSeedsIfNeeded } from "@/lib/community-picks/ensure-seeds";
import {
  activeGrowthFactor,
  activeReturnPct,
  averageLifetimeReturnPct,
  lifetimeReturnPct,
  pickGrowthFactor,
  pickReturnPct,
  totalGrowthFactor,
} from "@/lib/community-picks/growth";
import { fetchAuthoritativeSpot } from "@/lib/community-picks/pricing";
import { seedCampusStandings } from "@/lib/community-picks/seed-students";
import {
  DEFAULT_H2H_PERF_RANGE,
  periodReturnPct,
  resolvePickPeriodStart,
  type H2HPerfRange,
} from "@/lib/competitions/perf-range";
import { fetchPeriodBaselines } from "@/lib/competitions/period-baselines";
import { SEED_INSTITUTIONS } from "@/lib/groups/seed-institutions";
import { resolveNcaaDomain } from "@/lib/groups/ncaa-domains";
import { getPrimaryGroupForUser } from "@/lib/groups/store";
import type {
  CommunityPick,
  CommunityPickGroup,
  CommunityPickHistoryEntry,
  CommunityPicksPayload,
  CommunityStanding,
  SwapPickResult,
} from "@/lib/community-picks/types";

type PickRow = {
  user_id: string;
  group_id: string;
  ticker: string;
  entry_price: string;
  banked_growth_factor: string;
  picked_at: Date;
};

type HistoryRow = {
  ticker: string;
  start_spot: string;
  exit_spot: string;
  started_at: Date;
  closed_at: Date;
};

type GroupRow = {
  id: string;
  name: string;
  primary_color: string | null;
  institution_id: string | null;
  canonical_domain: string | null;
  ncaa_id: string | null;
  accent_color: string | null;
};

function groupPayload(group: GroupRow): CommunityPickGroup {
  const ncaaId = group.ncaa_id;
  return {
    groupId: group.id,
    name: group.name,
    primaryColor: group.primary_color,
    domain: group.canonical_domain ?? resolveNcaaDomain(ncaaId),
    ncaaId,
    accentColor: group.accent_color ?? group.primary_color,
  };
}

function seedStandings(range: H2HPerfRange = DEFAULT_H2H_PERF_RANGE): CommunityStanding[] {
  return seedCampusStandings(range);
}

function mapHistoryRow(row: HistoryRow): CommunityPickHistoryEntry {
  const startSpot = Number(row.start_spot);
  const exitSpot = Number(row.exit_spot);
  return {
    ticker: row.ticker.toUpperCase(),
    startSpot,
    exitSpot,
    pickReturnPct: pickReturnPct(startSpot, exitSpot),
    startedAt: row.started_at.toISOString(),
    closedAt: row.closed_at.toISOString(),
  };
}

function buildPickView(
  row: PickRow,
  currentPrice: number | null,
): CommunityPick {
  const entryPrice = Number(row.entry_price);
  const bankedGrowthFactor = Number(row.banked_growth_factor);
  const activeFactor =
    currentPrice === null ? 1 : activeGrowthFactor(entryPrice, currentPrice);
  const totalFactor = totalGrowthFactor(bankedGrowthFactor, activeFactor);

  return {
    ticker: row.ticker.toUpperCase(),
    entryPrice,
    currentPrice,
    activeReturnPct: currentPrice === null ? null : activeReturnPct(activeFactor),
    lifetimeReturnPct: currentPrice === null ? null : lifetimeReturnPct(totalFactor),
    bankedGrowthFactor,
    pickedAt: row.picked_at.toISOString(),
  };
}

export async function verifyGroupMembership(userId: string, groupId: string): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  const result = await query<{ ok: boolean }>(
    `select exists(
       select 1 from user_group_memberships where user_id = $1 and group_id = $2
     ) as ok`,
    [userId, groupId],
  );
  return result.rows[0]?.ok ?? false;
}

async function loadPickRow(
  queryFn: DbQuery,
  userId: string,
  groupId: string,
  forUpdate = false,
): Promise<PickRow | null> {
  const lock = forUpdate ? " for update" : "";
  const result = await queryFn<PickRow>(
    `select user_id, group_id, ticker, entry_price, banked_growth_factor, picked_at
     from community_picks
     where user_id = $1 and group_id = $2${lock}`,
    [userId, groupId],
  );
  return result.rows[0] ?? null;
}

async function loadPickHistory(userId: string, groupId: string): Promise<CommunityPickHistoryEntry[]> {
  const result = await query<HistoryRow>(
    `select ticker, start_spot, exit_spot, started_at, closed_at
     from community_pick_history
     where user_id = $1 and group_id = $2
     order by closed_at desc`,
    [userId, groupId],
  );
  return result.rows.map(mapHistoryRow);
}

export async function createInitialCommunityPick(input: {
  userId: string;
  groupId: string;
  ticker: string;
}): Promise<SwapPickResult> {
  if (!isDatabaseConfigured()) throw new Error("Database required to save community picks.");

  const isMember = await verifyGroupMembership(input.userId, input.groupId);
  if (!isMember) throw new Error("Join this community before setting a pick.");

  const ticker = input.ticker.trim().toUpperCase();
  const spotResult = await fetchAuthoritativeSpot(ticker);
  if (!spotResult.ok) throw new Error(spotResult.error);

  const pickRow = await withTransaction(async (queryTx) => {
    const existing = await loadPickRow(queryTx, input.userId, input.groupId, true);
    if (existing) {
      throw new Error("You already have an active pick. Use swap to change tickers.");
    }

    await queryTx(
      `insert into community_picks (
         user_id, group_id, ticker, entry_price, banked_growth_factor, picked_at, updated_at
       ) values ($1, $2, $3, $4, 1.0, now(), now())`,
      [input.userId, input.groupId, ticker, spotResult.spot],
    );

    const row = await loadPickRow(queryTx, input.userId, input.groupId);
    if (!row) throw new Error("Could not save pick.");
    return row;
  });

  const pick = buildPickView(pickRow, spotResult.spot);
  return { pick, pickHistory: [] };
}

export async function swapCommunityPick(input: {
  userId: string;
  groupId: string;
  newTicker: string;
}): Promise<SwapPickResult> {
  if (!isDatabaseConfigured()) throw new Error("Database required to save community picks.");

  const isMember = await verifyGroupMembership(input.userId, input.groupId);
  if (!isMember) throw new Error("Join this community before swapping a pick.");

  const newTicker = input.newTicker.trim().toUpperCase();
  const newSpotResult = await fetchAuthoritativeSpot(newTicker);
  if (!newSpotResult.ok) throw new Error(newSpotResult.error);

  const existing = await loadPickRow(query, input.userId, input.groupId);
  if (!existing) {
    throw new Error("Set an initial pick before swapping.");
  }

  const oldTicker = existing.ticker.toUpperCase();
  if (oldTicker === newTicker) {
    const currentSpot = await fetchAuthoritativeSpot(oldTicker);
    const price = currentSpot.ok ? currentSpot.spot : null;
    return {
      pick: buildPickView(existing, price),
      pickHistory: await loadPickHistory(input.userId, input.groupId),
    };
  }

  const oldSpotResult = await fetchAuthoritativeSpot(oldTicker);
  if (!oldSpotResult.ok) throw new Error(oldSpotResult.error);

  const pickRow = await withTransaction(async (queryTx) => {
    const locked = await loadPickRow(queryTx, input.userId, input.groupId, true);
    if (!locked) throw new Error("Set an initial pick before swapping.");
    if (locked.ticker.toUpperCase() !== oldTicker) {
      throw new Error("Pick changed while swapping. Try again.");
    }

    const startSpot = Number(locked.entry_price);
    const exitSpot = oldSpotResult.spot;
    const oldLegFactor = pickGrowthFactor(startSpot, exitSpot);
    const newBanked = Number(locked.banked_growth_factor) * oldLegFactor;

    await queryTx(
      `insert into community_pick_history (
         id, user_id, group_id, ticker, start_spot, exit_spot, pick_growth_factor, started_at, closed_at
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, now())`,
      [
        randomUUID(),
        input.userId,
        input.groupId,
        oldTicker,
        startSpot,
        exitSpot,
        oldLegFactor,
        locked.picked_at,
      ],
    );

    await queryTx(
      `update community_picks
       set ticker = $3,
           entry_price = $4,
           banked_growth_factor = $5,
           picked_at = now(),
           updated_at = now()
       where user_id = $1 and group_id = $2`,
      [input.userId, input.groupId, newTicker, newSpotResult.spot, newBanked],
    );

    const row = await loadPickRow(queryTx, input.userId, input.groupId);
    if (!row) throw new Error("Could not save pick.");
    return row;
  });

  return {
    pick: buildPickView(pickRow, newSpotResult.spot),
    pickHistory: await loadPickHistory(input.userId, input.groupId),
  };
}

export async function loadCommunityPicks(
  userId?: string,
  range: H2HPerfRange = DEFAULT_H2H_PERF_RANGE,
): Promise<CommunityPicksPayload> {
  if (!isDatabaseConfigured()) {
    return {
      authenticated: Boolean(userId),
      viewerGroup: null,
      viewerPick: null,
      pickHistory: [],
      standings: seedStandings(range),
      range,
    };
  }

  await ensureCampusPickSeedsIfNeeded().catch(() => undefined);

  const [pickResult, groupResult, primaryGroup] = await Promise.all([
    query<PickRow>(
      `select user_id, group_id, ticker, entry_price, banked_growth_factor, picked_at
       from community_picks
       order by picked_at asc`,
    ),
    query<GroupRow>(
      `select g.id, g.name, g.primary_color,
              i.id as institution_id,
              i.canonical_domain,
              i.ncaa_id,
              i.accent_color
       from groups g
       left join institutions i on i.id = g.institution_id
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
  const baselines = await fetchPeriodBaselines(tickers, range);
  const periodReturnsByGroup = new Map<string, number[]>();

  let viewerPick: CommunityPick | null = null;
  let pickHistory: CommunityPickHistoryEntry[] = [];

  for (const row of pickResult.rows) {
    const ticker = row.ticker.toUpperCase();
    const baseline = baselines.get(ticker);
    const currentPrice = baseline?.currentPrice ?? null;
    const pickView = buildPickView(row, currentPrice);
    if (currentPrice !== null) {
      const start = resolvePickPeriodStart({
        periodStartPrice: baseline?.startPrice ?? null,
        periodStartAt: baseline?.startAt ?? null,
        entryPrice: Number(row.entry_price),
        pickedAt: row.picked_at?.toISOString?.() ?? null,
        sameEtDayIsMidWindow: range === "1d",
      });
      if (start !== null) {
        const returns = periodReturnsByGroup.get(row.group_id) ?? [];
        returns.push(periodReturnPct(start, currentPrice));
        periodReturnsByGroup.set(row.group_id, returns);
      }
    }
    if (userId && row.user_id === userId && primaryGroup && row.group_id === primaryGroup.id) {
      viewerPick = pickView;
    }
  }

  if (userId && primaryGroup) {
    pickHistory = await loadPickHistory(userId, primaryGroup.id);
  }

  const pickCounts = new Map<string, number>();
  for (const row of pickResult.rows) {
    pickCounts.set(row.group_id, (pickCounts.get(row.group_id) ?? 0) + 1);
  }

  const groups = groupResult.rows.slice();
  if (primaryGroup && !groups.some((group) => group.id === primaryGroup.id)) {
    const institution = SEED_INSTITUTIONS.find((row) => row.id === primaryGroup.institutionId);
    groups.push({
      id: primaryGroup.id,
      name: primaryGroup.name,
      primary_color: primaryGroup.primaryColor,
      institution_id: primaryGroup.institutionId,
      canonical_domain: institution?.canonicalDomain ?? resolveNcaaDomain(institution?.ncaaId) ?? null,
      ncaa_id: institution?.ncaaId ?? null,
      accent_color: institution?.accentColor ?? null,
    });
  }

  const standings: CommunityStanding[] = groups
    .map((group) => {
      const returns = periodReturnsByGroup.get(group.id) ?? [];
      const pickCount = pickCounts.get(group.id) ?? 0;
      const avgReturnPct = averageLifetimeReturnPct(returns);
      const ranked = pickCount >= MIN_RANKED_MEMBERS && avgReturnPct !== null;
      return {
        ...groupPayload(group),
        pickCount,
        avgReturnPct,
        ranked,
      };
    })
    .sort((a, b) => {
      if (a.ranked !== b.ranked) return a.ranked ? -1 : 1;
      if (a.avgReturnPct === null && b.avgReturnPct !== null) return 1;
      if (a.avgReturnPct !== null && b.avgReturnPct === null) return -1;
      if (a.avgReturnPct !== b.avgReturnPct) {
        return (b.avgReturnPct ?? 0) - (a.avgReturnPct ?? 0);
      }
      if (a.pickCount !== b.pickCount) return b.pickCount - a.pickCount;
      return a.name.localeCompare(b.name);
    });

  const viewerStanding = primaryGroup
    ? standings.find((row) => row.groupId === primaryGroup.id) ?? null
    : null;

  return {
    authenticated: Boolean(userId),
    viewerGroup: viewerStanding
      ? {
          groupId: viewerStanding.groupId,
          name: viewerStanding.name,
          primaryColor: viewerStanding.primaryColor,
          domain: viewerStanding.domain,
          ncaaId: viewerStanding.ncaaId,
          accentColor: viewerStanding.accentColor,
        }
      : null,
    viewerPick,
    pickHistory,
    standings,
    range,
  };
}
