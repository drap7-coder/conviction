import { randomUUID } from "node:crypto";
import { isDatabaseConfigured, query, withTransaction, type DbQuery } from "@/lib/db";
import {
  displayAssetLabel,
  pricingSymbolForStored,
  resolveBtcGoldAsset,
  resolveInternationalAsset,
} from "@/lib/community-picks/asset-maps";
import {
  CALL_SLOTS,
  CALLS_REQUIRED,
  STOCK_SLOTS,
  type CallSlot,
  isStockSlot,
} from "@/lib/community-picks/call-slots";
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
import { seedCampusStandings, listCampusSeedStudents } from "@/lib/community-picks/seed-students";
import {
  DEFAULT_H2H_PERF_RANGE,
  pickPeriodReturnPct,
  type H2HPerfRange,
} from "@/lib/competitions/perf-range";
import { fetchPeriodBaselines } from "@/lib/competitions/period-baselines";
import { fetchFreshStockQuotes } from "@/lib/market/quotes";
import { listSeedCanonicalCommunities } from "@/lib/groups/seed-groups";
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

async function currentPricesForSymbols(symbols: string[]): Promise<Map<string, number>> {
  const unique = [...new Set(symbols.map((symbol) => symbol.toUpperCase()).filter(Boolean))];
  if (unique.length === 0) return new Map();
  const quotes = await fetchFreshStockQuotes(unique);
  const prices = new Map<string, number>();
  for (const quote of quotes) {
    const spot = quote.price ?? quote.previousClose;
    if (spot !== null && Number.isFinite(spot) && spot > 0) {
      prices.set(quote.ticker.toUpperCase(), spot);
    }
  }
  return prices;
}

type PickRow = {
  user_id: string;
  group_id: string;
  call_slot: CallSlot;
  ticker: string;
  entry_price: string;
  banked_growth_factor: string;
  picked_at: Date;
};

type HistoryRow = {
  call_slot: CallSlot;
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

/** Every seeded campus stays on the board with a $100k starting book. */
function ensureSeedCampusGroups(groups: GroupRow[]): GroupRow[] {
  const out = groups.slice();
  for (const seed of listSeedCanonicalCommunities()) {
    if (out.some((group) => group.id === seed.id)) continue;
    const institution = SEED_INSTITUTIONS.find((row) => row.id === seed.institutionId);
    out.push({
      id: seed.id,
      name: seed.name,
      primary_color: seed.primaryColor,
      institution_id: seed.institutionId,
      canonical_domain:
        institution?.canonicalDomain ?? resolveNcaaDomain(institution?.ncaaId) ?? null,
      ncaa_id: institution?.ncaaId ?? null,
      accent_color: institution?.accentColor ?? seed.primaryColor,
    });
  }
  return out;
}

function seedStandings(range: H2HPerfRange = DEFAULT_H2H_PERF_RANGE): CommunityStanding[] {
  return seedCampusStandings(range);
}

/** Resolve what we store in `ticker` column: asset id for macro, symbol for stocks. */
export function normalizeStoredAsset(slot: CallSlot, raw: string): string {
  const value = raw.trim().toUpperCase();
  if (slot === "BTC_GOLD") {
    const asset = resolveBtcGoldAsset(value);
    if (!asset) throw new Error("Choose Bitcoin or Gold.");
    return asset.id;
  }
  if (slot === "INTERNATIONAL") {
    const asset = resolveInternationalAsset(value);
    if (!asset) throw new Error("Choose a listed international market.");
    return asset.id;
  }
  if (!value) throw new Error("Enter a ticker.");
  return value;
}

function buildPickView(row: PickRow, currentPrice: number | null): CommunityPick {
  const entryPrice = Number(row.entry_price);
  const bankedGrowthFactor = Number(row.banked_growth_factor);
  const activeFactor =
    currentPrice === null ? 1 : activeGrowthFactor(entryPrice, currentPrice);
  const totalFactor = totalGrowthFactor(bankedGrowthFactor, activeFactor);
  const assetId = row.ticker.toUpperCase();
  const slot = row.call_slot;
  return {
    callSlot: slot,
    assetId,
    pricingSymbol: pricingSymbolForStored(slot, assetId),
    label: displayAssetLabel(slot, assetId),
    entryPrice,
    currentPrice,
    activeReturnPct: currentPrice === null ? null : activeReturnPct(activeFactor),
    // Missing spot → active factor 1, so lifetime is banked-only (0% on a fresh $100k book).
    lifetimeReturnPct: lifetimeReturnPct(totalFactor),
    bankedGrowthFactor,
    pickedAt: row.picked_at.toISOString(),
  };
}

function mapHistoryRow(row: HistoryRow): CommunityPickHistoryEntry {
  const startSpot = Number(row.start_spot);
  const exitSpot = Number(row.exit_spot);
  const assetId = row.ticker.toUpperCase();
  const slot = row.call_slot;
  return {
    callSlot: slot,
    assetId,
    pricingSymbol: pricingSymbolForStored(slot, assetId),
    startSpot,
    exitSpot,
    pickReturnPct: pickReturnPct(startSpot, exitSpot),
    startedAt: row.started_at.toISOString(),
    closedAt: row.closed_at.toISOString(),
  };
}

function summarizePicks(picks: Partial<Record<CallSlot, CommunityPick>>) {
  const filled = CALL_SLOTS.filter((slot) => picks[slot]);
  const lifetimes = filled
    .map((slot) => picks[slot]?.lifetimeReturnPct)
    .filter((value): value is number => typeof value === "number");
  const filledCount = filled.length;
  const boardComplete = filledCount >= CALLS_REQUIRED;
  return {
    filledCount,
    boardComplete,
    iqbullsReturnPct: averageLifetimeReturnPct(lifetimes),
    leaderboardEligible: boardComplete,
    viewerPick: picks.STOCK_1 ?? picks[filled[0]!] ?? null,
  };
}

/** Guest / no-DB standings: lifetime $100k book returns from live spots. */
async function scoreOfflineStandings(range: H2HPerfRange = DEFAULT_H2H_PERF_RANGE): Promise<CommunityStanding[]> {
  const students = listCampusSeedStudents();
  const tickers = [...new Set(students.map((row) => row.ticker.toUpperCase()))];
  const periodBaselines = await fetchPeriodBaselines(tickers, range);
  const returnsByGroup = new Map<string, number[]>();
  let liveHits = 0;

  for (const student of students) {
    const symbol = student.ticker.toUpperCase();
    const baseline = periodBaselines.get(symbol);
    const ret = pickPeriodReturnPct({
      range,
      entryPrice: student.entryPrice,
      pickedAt: null,
      baseline: baseline ?? null,
    });

    if (ret === null || !Number.isFinite(ret)) continue;
    liveHits += 1;
    const rows = returnsByGroup.get(student.groupId) ?? [];
    rows.push(ret);
    returnsByGroup.set(student.groupId, rows);
  }

  if (liveHits === 0) return seedStandings(range);

  const byGroup = new Map<string, typeof students>();
  for (const student of students) {
    const rows = byGroup.get(student.groupId) ?? [];
    rows.push(student);
    byGroup.set(student.groupId, rows);
  }

  return listSeedCanonicalCommunities()
    .map((group) => {
      const institution = SEED_INSTITUTIONS.find((row) => row.id === group.institutionId);
      const ncaaId = institution?.ncaaId ?? null;
      const members = byGroup.get(group.id) ?? [];
      const returns = returnsByGroup.get(group.id) ?? [];
      const avg =
        returns.length > 0
          ? averageLifetimeReturnPct(returns)
          : averageLifetimeReturnPct(
              members.map((member) => lifetimeReturnPct(member.bankedGrowthFactor)),
            );
      const pickCount = members.length;
      return {
        groupId: group.id,
        name: group.name,
        primaryColor: group.primaryColor,
        domain: institution?.canonicalDomain ?? resolveNcaaDomain(ncaaId),
        ncaaId,
        accentColor: institution?.accentColor ?? group.primaryColor,
        pickCount,
        avgReturnPct: avg ?? 0,
        ranked: pickCount >= MIN_RANKED_MEMBERS,
      };
    })
    .sort((a, b) => {
      if (a.ranked !== b.ranked) return a.ranked ? -1 : 1;
      if (a.avgReturnPct !== b.avgReturnPct) {
        return (b.avgReturnPct ?? 0) - (a.avgReturnPct ?? 0);
      }
      return a.name.localeCompare(b.name);
    });
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
  callSlot: CallSlot,
  forUpdate = false,
): Promise<PickRow | null> {
  const lock = forUpdate ? " for update" : "";
  const result = await queryFn<PickRow>(
    `select user_id, group_id, call_slot, ticker, entry_price, banked_growth_factor, picked_at
     from community_picks
     where user_id = $1 and group_id = $2 and call_slot = $3${lock}`,
    [userId, groupId, callSlot],
  );
  return result.rows[0] ?? null;
}

async function loadMemberPickRows(
  queryFn: DbQuery,
  userId: string,
  groupId: string,
): Promise<PickRow[]> {
  const result = await queryFn<PickRow>(
    `select user_id, group_id, call_slot, ticker, entry_price, banked_growth_factor, picked_at
     from community_picks
     where user_id = $1 and group_id = $2`,
    [userId, groupId],
  );
  return result.rows;
}

async function loadPickHistory(
  userId: string,
  groupId: string,
  callSlot?: CallSlot,
): Promise<CommunityPickHistoryEntry[]> {
  if (callSlot) {
    const result = await query<HistoryRow>(
      `select call_slot, ticker, start_spot, exit_spot, started_at, closed_at
       from community_pick_history
       where user_id = $1 and group_id = $2 and call_slot = $3
       order by closed_at desc`,
      [userId, groupId, callSlot],
    );
    return result.rows.map(mapHistoryRow);
  }
  const result = await query<HistoryRow>(
    `select call_slot, ticker, start_spot, exit_spot, started_at, closed_at
     from community_pick_history
     where user_id = $1 and group_id = $2
     order by closed_at desc`,
    [userId, groupId],
  );
  return result.rows.map(mapHistoryRow);
}

async function assertNoDuplicateStock(
  queryFn: DbQuery,
  userId: string,
  groupId: string,
  ticker: string,
  exceptSlot?: CallSlot,
): Promise<void> {
  const rows = await loadMemberPickRows(queryFn, userId, groupId);
  for (const row of rows) {
    if (!isStockSlot(row.call_slot)) continue;
    if (exceptSlot && row.call_slot === exceptSlot) continue;
    if (row.ticker.toUpperCase() === ticker) {
      throw new Error(`${ticker} is already one of your stock picks.`);
    }
  }
}

async function viewerPicksFromRows(
  rows: PickRow[],
  priceBySymbol: Map<string, number | null>,
): Promise<Partial<Record<CallSlot, CommunityPick>>> {
  const picks: Partial<Record<CallSlot, CommunityPick>> = {};
  for (const row of rows) {
    const symbol = pricingSymbolForStored(row.call_slot, row.ticker);
    picks[row.call_slot] = buildPickView(row, priceBySymbol.get(symbol) ?? null);
  }
  return picks;
}

export async function createInitialCommunityPick(input: {
  userId: string;
  groupId: string;
  callSlot: CallSlot;
  asset: string;
}): Promise<SwapPickResult> {
  if (!isDatabaseConfigured()) throw new Error("Database required to save community picks.");

  const isMember = await verifyGroupMembership(input.userId, input.groupId);
  if (!isMember) throw new Error("Join this community before setting a pick.");

  const assetId = normalizeStoredAsset(input.callSlot, input.asset);
  const pricingSymbol = pricingSymbolForStored(input.callSlot, assetId);
  const spotResult = await fetchAuthoritativeSpot(pricingSymbol);
  if (!spotResult.ok) throw new Error(spotResult.error);

  const pickRow = await withTransaction(async (queryTx) => {
    const existing = await loadPickRow(queryTx, input.userId, input.groupId, input.callSlot, true);
    if (existing) {
      throw new Error("This pick is already set. Use Confirm Swap to change it.");
    }
    if (isStockSlot(input.callSlot)) {
      await assertNoDuplicateStock(queryTx, input.userId, input.groupId, assetId);
    }

    await queryTx(
      `insert into community_picks (
         user_id, group_id, call_slot, ticker, entry_price, banked_growth_factor, picked_at, updated_at
       ) values ($1, $2, $3, $4, $5, 1.0, now(), now())`,
      [input.userId, input.groupId, input.callSlot, assetId, spotResult.spot],
    );

    const row = await loadPickRow(queryTx, input.userId, input.groupId, input.callSlot);
    if (!row) throw new Error("Could not save pick.");
    return row;
  });

  const memberRows = await loadMemberPickRows(query, input.userId, input.groupId);
  const priceBySymbol = new Map<string, number | null>();
  for (const row of memberRows) {
    const symbol = pricingSymbolForStored(row.call_slot, row.ticker);
    priceBySymbol.set(
      symbol,
      row.call_slot === input.callSlot ? spotResult.spot : priceBySymbol.get(symbol) ?? null,
    );
  }
  priceBySymbol.set(pricingSymbol, spotResult.spot);
  const viewerPicks = await viewerPicksFromRows(memberRows, priceBySymbol);
  const summary = summarizePicks(viewerPicks);

  return {
    pick: buildPickView(pickRow, spotResult.spot),
    viewerPicks,
    ...summary,
    pickHistory: await loadPickHistory(input.userId, input.groupId),
  };
}

export async function swapCommunityPick(input: {
  userId: string;
  groupId: string;
  callSlot: CallSlot;
  asset: string;
}): Promise<SwapPickResult> {
  if (!isDatabaseConfigured()) throw new Error("Database required to save community picks.");

  const isMember = await verifyGroupMembership(input.userId, input.groupId);
  if (!isMember) throw new Error("Join this community before swapping a pick.");

  const assetId = normalizeStoredAsset(input.callSlot, input.asset);
  const pricingSymbol = pricingSymbolForStored(input.callSlot, assetId);
  const newSpotResult = await fetchAuthoritativeSpot(pricingSymbol);
  if (!newSpotResult.ok) throw new Error(newSpotResult.error);

  const existing = await loadPickRow(query, input.userId, input.groupId, input.callSlot);
  if (!existing) {
    throw new Error("Set this pick before swapping.");
  }

  const oldAssetId = existing.ticker.toUpperCase();
  if (oldAssetId === assetId) {
    const currentSpot = await fetchAuthoritativeSpot(
      pricingSymbolForStored(input.callSlot, oldAssetId),
    );
    const price = currentSpot.ok ? currentSpot.spot : null;
    const memberRows = await loadMemberPickRows(query, input.userId, input.groupId);
    const priceBySymbol = new Map<string, number | null>();
    for (const row of memberRows) {
      const symbol = pricingSymbolForStored(row.call_slot, row.ticker);
      priceBySymbol.set(symbol, row.call_slot === input.callSlot ? price : null);
    }
    const viewerPicks = await viewerPicksFromRows(memberRows, priceBySymbol);
    const summary = summarizePicks(viewerPicks);
    return {
      pick: buildPickView(existing, price),
      viewerPicks,
      ...summary,
      pickHistory: await loadPickHistory(input.userId, input.groupId),
    };
  }

  const oldPricing = pricingSymbolForStored(input.callSlot, oldAssetId);
  const oldSpotResult = await fetchAuthoritativeSpot(oldPricing);
  if (!oldSpotResult.ok) throw new Error(oldSpotResult.error);

  const pickRow = await withTransaction(async (queryTx) => {
    const locked = await loadPickRow(queryTx, input.userId, input.groupId, input.callSlot, true);
    if (!locked) throw new Error("Set this pick before swapping.");
    if (locked.ticker.toUpperCase() !== oldAssetId) {
      throw new Error("Pick changed while swapping. Try again.");
    }
    if (isStockSlot(input.callSlot)) {
      await assertNoDuplicateStock(queryTx, input.userId, input.groupId, assetId, input.callSlot);
    }

    const startSpot = Number(locked.entry_price);
    const exitSpot = oldSpotResult.spot;
    const oldLegFactor = pickGrowthFactor(startSpot, exitSpot);
    const newBanked = Number(locked.banked_growth_factor) * oldLegFactor;

    await queryTx(
      `insert into community_pick_history (
         id, user_id, group_id, call_slot, ticker, start_spot, exit_spot, pick_growth_factor, started_at, closed_at
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())`,
      [
        randomUUID(),
        input.userId,
        input.groupId,
        input.callSlot,
        oldAssetId,
        startSpot,
        exitSpot,
        oldLegFactor,
        locked.picked_at,
      ],
    );

    await queryTx(
      `update community_picks
       set ticker = $4,
           entry_price = $5,
           banked_growth_factor = $6,
           picked_at = now(),
           updated_at = now()
       where user_id = $1 and group_id = $2 and call_slot = $3`,
      [input.userId, input.groupId, input.callSlot, assetId, newSpotResult.spot, newBanked],
    );

    const row = await loadPickRow(queryTx, input.userId, input.groupId, input.callSlot);
    if (!row) throw new Error("Could not save pick.");
    return row;
  });

  const memberRows = await loadMemberPickRows(query, input.userId, input.groupId);
  const priceBySymbol = new Map<string, number | null>([[pricingSymbol, newSpotResult.spot]]);
  const viewerPicks = await viewerPicksFromRows(memberRows, priceBySymbol);
  const summary = summarizePicks(viewerPicks);

  return {
    pick: buildPickView(pickRow, newSpotResult.spot),
    viewerPicks,
    ...summary,
    pickHistory: await loadPickHistory(input.userId, input.groupId),
  };
}

export async function loadCommunityPicks(
  userId?: string,
  range: H2HPerfRange = DEFAULT_H2H_PERF_RANGE,
): Promise<CommunityPicksPayload> {
  if (!isDatabaseConfigured()) {
    const standings = await scoreOfflineStandings(range);
    return {
      authenticated: Boolean(userId),
      viewerGroup: null,
      viewerPick: null,
      viewerPicks: {},
      filledCount: 0,
      boardComplete: false,
      iqbullsReturnPct: null,
      leaderboardEligible: false,
      pickHistory: [],
      standings,
      range,
    };
  }

  await ensureCampusPickSeedsIfNeeded().catch(() => undefined);

  const [pickResult, groupResult, primaryGroup] = await Promise.all([
    query<PickRow>(
      `select user_id, group_id, call_slot, ticker, entry_price, banked_growth_factor, picked_at
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

  const pricingSymbols = [
    ...new Set(
      pickResult.rows.map((row) => pricingSymbolForStored(row.call_slot, row.ticker)),
    ),
  ];
  const prices = await currentPricesForSymbols(pricingSymbols);
  const periodBaselines = await fetchPeriodBaselines(pricingSymbols, range);

  /** memberKey = userId::groupId → slot lifetime returns (only when board complete). */
  const memberSlotReturns = new Map<string, Map<CallSlot, number>>();
  const memberSlotCounts = new Map<string, number>();
  const viewerPicks: Partial<Record<CallSlot, CommunityPick>> = {};

  for (const row of pickResult.rows) {
    const memberKey = `${row.user_id}::${row.group_id}`;
    memberSlotCounts.set(memberKey, (memberSlotCounts.get(memberKey) ?? 0) + 1);

    const symbol = pricingSymbolForStored(row.call_slot, row.ticker);
    const currentPrice = prices.get(symbol) ?? null;
    const pickView = buildPickView(row, currentPrice);

    if (userId && primaryGroup && row.user_id === userId && row.group_id === primaryGroup.id) {
      viewerPicks[row.call_slot] = pickView;
    }

    const periodBaseline = periodBaselines.get(symbol) ?? null;
    const periodReturnPct = pickPeriodReturnPct({
      range,
      entryPrice: Number(row.entry_price),
      pickedAt: row.picked_at.toISOString(),
      baseline: periodBaseline,
    });

    // If Yahoo period baselines fail, fall back to the lifetime/$100k edge
    // so the board doesn't go empty.
    const returnPctToUse = periodReturnPct ?? pickView.lifetimeReturnPct;
    if (returnPctToUse === null) continue;
    const slotMap = memberSlotReturns.get(memberKey) ?? new Map();
    slotMap.set(row.call_slot, returnPctToUse);
    memberSlotReturns.set(memberKey, slotMap);
  }

  // Campus score: completed boards only — average lifetime IQBulls on the $100k book.
  const periodReturnsByGroup = new Map<string, number[]>();
  const eligibleCountByGroup = new Map<string, number>();

  for (const [memberKey, count] of memberSlotCounts) {
    const groupId = memberKey.split("::")[1]!;
    if (count < CALLS_REQUIRED) continue;
    const slotMap = memberSlotReturns.get(memberKey);
    if (!slotMap || slotMap.size < CALLS_REQUIRED) continue;
    const values = CALL_SLOTS.map((slot) => slotMap.get(slot)).filter(
      (value): value is number => typeof value === "number",
    );
    if (values.length < CALLS_REQUIRED) continue;
    const memberAvg = averageLifetimeReturnPct(values);
    if (memberAvg === null) continue;
    eligibleCountByGroup.set(groupId, (eligibleCountByGroup.get(groupId) ?? 0) + 1);
    const returns = periodReturnsByGroup.get(groupId) ?? [];
    returns.push(memberAvg);
    periodReturnsByGroup.set(groupId, returns);
  }

  let pickHistory: CommunityPickHistoryEntry[] = [];
  if (userId && primaryGroup) {
    pickHistory = await loadPickHistory(userId, primaryGroup.id);
  }

  const groups = ensureSeedCampusGroups(groupResult.rows.slice());
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
      const pickCount = eligibleCountByGroup.get(group.id) ?? 0;
      // Always populate the $100k premise — flat/missing tape → 0%.
      const avgReturnPct = averageLifetimeReturnPct(returns) ?? 0;
      const ranked = pickCount >= MIN_RANKED_MEMBERS;
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
  const summary = summarizePicks(viewerPicks);

  /**
   * My Pick headline must use the same window as standings (default 1w).
   * Lifetime compound still lives on each pick; the $100k Performance strip
   * is what users compare to their school's row.
   */
  let iqbullsReturnPct = summary.iqbullsReturnPct;
  if (userId && primaryGroup) {
    const memberKey = `${userId}::${primaryGroup.id}`;
    const slotMap = memberSlotReturns.get(memberKey);
    if (slotMap && slotMap.size > 0) {
      const periodValues = CALL_SLOTS.map((slot) => slotMap.get(slot)).filter(
        (value): value is number => typeof value === "number",
      );
      if (periodValues.length > 0) {
        iqbullsReturnPct = averageLifetimeReturnPct(periodValues);
      }
    }
  }

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
    viewerPick: summary.viewerPick,
    viewerPicks,
    filledCount: summary.filledCount,
    boardComplete: summary.boardComplete,
    iqbullsReturnPct,
    leaderboardEligible: summary.leaderboardEligible,
    pickHistory,
    standings,
    range,
  };
}

export { STOCK_SLOTS, CALL_SLOTS, CALLS_REQUIRED };
