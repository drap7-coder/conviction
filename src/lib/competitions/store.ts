import { isDatabaseConfigured, query } from "@/lib/db";
import { resolveNcaaDomain } from "@/lib/groups/ncaa-domains";
import {
  findSeedGroupById,
  listSeedCanonicalCommunities,
} from "@/lib/groups/seed-groups";
import { SEED_INSTITUTIONS } from "@/lib/groups/seed-institutions";
import {
  getPrimaryGroupForUser,
  listActiveGroups,
} from "@/lib/groups/store";
import type {
  Competition,
  CompetitionGroupSide,
  CompetitionPick,
  CompetitionStatus,
  HeadToHeadPayload,
  HeadToHeadSchoolOption,
  CompetitionViewerState,
} from "@/lib/competitions/types";
import {
  isSubmissionOpen,
  weekWindowContaining,
} from "@/lib/competitions/schedule";
import {
  averageLifetimeReturnPct,
  lifetimeReturnPct,
  totalGrowthFactor,
  activeGrowthFactor,
} from "@/lib/community-picks/growth";
import { ensureCampusPickSeedsIfNeeded } from "@/lib/community-picks/ensure-seeds";
import { listCampusSeedStudents } from "@/lib/community-picks/seed-students";
import { fetchStockQuotes } from "@/lib/market/quotes";

type GroupLogoMeta = {
  name: string;
  primaryColor: string | null;
  domain: string | null;
  ncaaId: string | null;
  accentColor: string | null;
};

/** Platform-seeded rivalries — data-driven, not hardcoded in UI. */
export const RIVALRY_PAIRS: Array<{ groupAId: string; groupBId: string; slug: string }> = [
  { groupAId: "group-wm", groupBId: "group-rpi", slug: "wm-rpi" },
];

type CompetitionRow = {
  id: string;
  group_a_id: string;
  group_b_id: string;
  period_start: Date;
  period_end: Date;
  status: CompetitionStatus;
  metric: string;
  locked_at: Date | null;
  winner_group_id: string | null;
};

type PickRow = {
  id: string;
  competition_id: string;
  user_id: string;
  group_id: string;
  ticker: string;
  start_price: string | null;
  current_price: string | null;
  final_price: string | null;
  return_pct: string | null;
  submitted_at: Date;
  locked_at: Date | null;
};

function mapCompetition(row: CompetitionRow): Competition {
  return {
    id: row.id,
    groupAId: row.group_a_id,
    groupBId: row.group_b_id,
    periodStart: row.period_start.toISOString(),
    periodEnd: row.period_end.toISOString(),
    status: row.status,
    metric: "avg_pct_return",
    lockedAt: row.locked_at?.toISOString() ?? null,
    winnerGroupId: row.winner_group_id,
  };
}

function mapPick(row: PickRow): CompetitionPick {
  return {
    id: row.id,
    competitionId: row.competition_id,
    userId: row.user_id,
    groupId: row.group_id,
    ticker: row.ticker.toUpperCase(),
    startPrice: row.start_price !== null ? Number(row.start_price) : null,
    currentPrice: row.current_price !== null ? Number(row.current_price) : null,
    finalPrice: row.final_price !== null ? Number(row.final_price) : null,
    returnPct: row.return_pct !== null ? Number(row.return_pct) : null,
    submittedAt: row.submitted_at.toISOString(),
    lockedAt: row.locked_at?.toISOString() ?? null,
  };
}

async function groupMeta(groupId: string): Promise<GroupLogoMeta> {
  const seed = findSeedGroupById(groupId);
  if (seed) {
    const institution = SEED_INSTITUTIONS.find((row) => row.id === seed.institutionId);
    return {
      name: seed.name,
      primaryColor: seed.primaryColor,
      domain: institution?.canonicalDomain ?? resolveNcaaDomain(institution?.ncaaId) ?? null,
      ncaaId: institution?.ncaaId ?? null,
      accentColor: institution?.accentColor ?? seed.primaryColor,
    };
  }
  if (!isDatabaseConfigured()) {
    return {
      name: groupId,
      primaryColor: null,
      domain: null,
      ncaaId: null,
      accentColor: null,
    };
  }
  try {
    const result = await query<{
      name: string;
      primary_color: string | null;
      canonical_domain: string | null;
      ncaa_id: string | null;
      accent_color: string | null;
    }>(
      `select g.name, g.primary_color,
              i.canonical_domain, i.ncaa_id, i.accent_color
       from groups g
       left join institutions i on i.id = g.institution_id
       where g.id = $1
       limit 1`,
      [groupId],
    );
    const row = result.rows[0];
    const ncaaId = row?.ncaa_id ?? null;
    return {
      name: row?.name ?? groupId,
      primaryColor: row?.primary_color ?? null,
      domain: row?.canonical_domain ?? resolveNcaaDomain(ncaaId),
      ncaaId,
      accentColor: row?.accent_color ?? row?.primary_color ?? null,
    };
  } catch {
    return {
      name: groupId,
      primaryColor: null,
      domain: null,
      ncaaId: null,
      accentColor: null,
    };
  }
}

export async function ensureWeeklyCompetitions(now = new Date()): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const window = weekWindowContaining(now);
  for (const pair of RIVALRY_PAIRS) {
    const id = `comp-${pair.slug}-${window.weekKey}`;
    await query(
      `insert into competitions (
         id, group_a_id, group_b_id, period_start, period_end, status, metric
       ) values ($1, $2, $3, $4, $5, 'open', 'avg_pct_return')
       on conflict (id) do nothing`,
      [id, pair.groupAId, pair.groupBId, window.periodStart, window.periodEnd],
    );
  }
}

export async function getActiveCompetition(): Promise<Competition | null> {
  if (!isDatabaseConfigured()) return null;
  await ensureWeeklyCompetitions();
  const result = await query<CompetitionRow>(
    `select id, group_a_id, group_b_id, period_start, period_end, status, metric, locked_at, winner_group_id
     from competitions
     where status in ('open', 'live', 'final')
     order by period_start desc
     limit 1`,
  );
  const row = result.rows[0];
  return row ? mapCompetition(row) : null;
}

function normalizeGroupToken(groupId: string): string {
  return groupId.replace(/[^a-z0-9_-]+/gi, "-").toLowerCase();
}

/** Stable rivalry slug — order-independent; classic pairs keep legacy short slugs. */
export function canonicalCompetitionSlug(groupAId: string, groupBId: string): string {
  const rivalry = RIVALRY_PAIRS.find(
    (pair) =>
      (pair.groupAId === groupAId && pair.groupBId === groupBId) ||
      (pair.groupAId === groupBId && pair.groupBId === groupAId),
  );
  if (rivalry) return rivalry.slug;
  return [groupAId, groupBId]
    .map(normalizeGroupToken)
    .sort()
    .join("-vs-");
}

function competitionIdForWeek(slug: string, weekKey: string): string {
  return `comp-${slug}-${weekKey}`;
}

function syntheticCompetition(groupAId: string, groupBId: string, now = new Date()): Competition {
  const window = weekWindowContaining(now);
  return {
    id: competitionIdForWeek(canonicalCompetitionSlug(groupAId, groupBId), window.weekKey),
    groupAId,
    groupBId,
    periodStart: window.periodStart.toISOString(),
    periodEnd: window.periodEnd.toISOString(),
    status: "open",
    metric: "avg_pct_return",
    lockedAt: null,
    winnerGroupId: null,
  };
}

/** Ensure a weekly H2H row exists. Display order (A/B) is preserved; id is canonical. */
export async function getOrCreateCompetitionForPair(
  groupAId: string,
  groupBId: string,
  now = new Date(),
): Promise<Competition | null> {
  const a = groupAId.trim();
  const b = groupBId.trim();
  if (!a || !b || a === b) return null;

  if (!isDatabaseConfigured()) {
    return syntheticCompetition(a, b, now);
  }

  const window = weekWindowContaining(now);
  const slug = canonicalCompetitionSlug(a, b);
  const id = competitionIdForWeek(slug, window.weekKey);

  // Prefer an existing same-week row for this pair (either order / legacy id) that already has picks.
  const existing = await query<CompetitionRow & { pick_count: string }>(
    `select c.id, c.group_a_id, c.group_b_id, c.period_start, c.period_end, c.status, c.metric,
            c.locked_at, c.winner_group_id,
            (select count(*)::text from competition_picks p where p.competition_id = c.id) as pick_count
     from competitions c
     where c.period_start = $1
       and (
         c.id = $2
         or (c.group_a_id = $3 and c.group_b_id = $4)
         or (c.group_a_id = $4 and c.group_b_id = $3)
       )
     order by (select count(*) from competition_picks p where p.competition_id = c.id) desc,
              case when c.id = $2 then 0 else 1 end
     limit 1`,
    [window.periodStart, id, a, b],
  );
  if (existing.rows[0]) {
    const row = existing.rows[0];
    // Keep caller's display sides even if the stored row flipped A/B.
    return {
      ...mapCompetition(row),
      groupAId: a,
      groupBId: b,
    };
  }

  await query(
    `insert into competitions (
       id, group_a_id, group_b_id, period_start, period_end, status, metric
     ) values ($1, $2, $3, $4, $5, 'open', 'avg_pct_return')
     on conflict (id) do nothing`,
    [id, a, b, window.periodStart, window.periodEnd],
  );

  const result = await query<CompetitionRow>(
    `select id, group_a_id, group_b_id, period_start, period_end, status, metric, locked_at, winner_group_id
     from competitions where id = $1 limit 1`,
    [id],
  );
  const row = result.rows[0];
  if (!row) return syntheticCompetition(a, b, now);
  return {
    ...mapCompetition(row),
    groupAId: a,
    groupBId: b,
  };
}

function schoolOptionFromMeta(groupId: string, meta: GroupLogoMeta): HeadToHeadSchoolOption {
  return {
    groupId,
    name: meta.name,
    primaryColor: meta.primaryColor,
    domain: meta.domain,
    ncaaId: meta.ncaaId,
    accentColor: meta.accentColor,
  };
}

export async function listHeadToHeadSchools(): Promise<HeadToHeadSchoolOption[]> {
  const byId = new Map<string, HeadToHeadSchoolOption>();

  for (const group of listSeedCanonicalCommunities()) {
    const meta = await groupMeta(group.id);
    byId.set(group.id, schoolOptionFromMeta(group.id, meta));
  }

  try {
    const active = await listActiveGroups();
    for (const group of active) {
      if (byId.has(group.id)) continue;
      const meta = await groupMeta(group.id);
      byId.set(group.id, schoolOptionFromMeta(group.id, meta));
    }
  } catch {
    // Seed list is enough offline.
  }

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Default A = viewer's school (or W&M); B = classic rival or first other school. */
export function pickDefaultH2HPair(
  schools: HeadToHeadSchoolOption[],
  viewerPrimaryGroupId: string | null,
): { groupAId: string; groupBId: string } {
  const ids = schools.map((school) => school.groupId);
  const fallbackA = ids.includes("group-wm") ? "group-wm" : ids[0] ?? "group-wm";
  const fallbackB = ids.includes("group-rpi") && fallbackA !== "group-rpi"
    ? "group-rpi"
    : ids.find((id) => id !== fallbackA) ?? "group-rpi";

  const primary =
    viewerPrimaryGroupId && ids.includes(viewerPrimaryGroupId)
      ? viewerPrimaryGroupId
      : fallbackA;

  const rivalPair = RIVALRY_PAIRS.find(
    (pair) => pair.groupAId === primary || pair.groupBId === primary,
  );
  let other =
    rivalPair
      ? rivalPair.groupAId === primary
        ? rivalPair.groupBId
        : rivalPair.groupAId
      : ids.find((id) => id !== primary) ?? fallbackB;

  if (!ids.includes(other) || other === primary) {
    other = ids.find((id) => id !== primary) ?? fallbackB;
  }

  return { groupAId: primary, groupBId: other };
}

export async function listPicksForCompetition(competitionId: string): Promise<CompetitionPick[]> {
  if (!isDatabaseConfigured()) return [];
  const result = await query<PickRow>(
    `select id, competition_id, user_id, group_id, ticker,
            start_price, current_price, final_price, return_pct, submitted_at, locked_at
     from competition_picks
     where competition_id = $1`,
    [competitionId],
  );
  return result.rows.map((row) => mapPick(row));
}

/** Continuous campus lifetime scores for a school (My Pick / community_picks). */
export async function scoreCampusSide(
  groupId: string,
): Promise<{ avgReturnPct: number | null; pickCount: number }> {
  if (!groupId) return { avgReturnPct: null, pickCount: 0 };

  if (!isDatabaseConfigured()) {
    const students = listCampusSeedStudents().filter((row) => row.groupId === groupId);
    if (students.length === 0) return { avgReturnPct: null, pickCount: 0 };
    const returns = students.map((row) => (row.bankedGrowthFactor - 1) * 100);
    return {
      avgReturnPct: averageLifetimeReturnPct(returns),
      pickCount: students.length,
    };
  }

  await ensureCampusPickSeedsIfNeeded().catch(() => undefined);

  const result = await query<{
    ticker: string;
    entry_price: string;
    banked_growth_factor: string;
  }>(
    `select ticker, entry_price, banked_growth_factor
     from community_picks
     where group_id = $1`,
    [groupId],
  );
  if (result.rows.length === 0) return { avgReturnPct: null, pickCount: 0 };

  const tickers = [...new Set(result.rows.map((row) => row.ticker.toUpperCase()))];
  const quotes = await fetchStockQuotes(tickers);
  const byTicker = new Map(quotes.map((quote) => [quote.ticker.toUpperCase(), quote]));
  const returns: number[] = [];

  for (const row of result.rows) {
    const quote = byTicker.get(row.ticker.toUpperCase());
    const current = quote?.price ?? quote?.previousClose ?? null;
    if (current === null || !Number.isFinite(current) || current <= 0) continue;
    const entry = Number(row.entry_price);
    const banked = Number(row.banked_growth_factor);
    if (!Number.isFinite(entry) || entry <= 0) continue;
    const total = totalGrowthFactor(banked, activeGrowthFactor(entry, current));
    returns.push(lifetimeReturnPct(total));
  }

  return {
    avgReturnPct: averageLifetimeReturnPct(returns),
    pickCount: result.rows.length,
  };
}

export async function getUserPick(
  competitionId: string,
  userId: string,
): Promise<CompetitionPick | null> {
  if (!userId || !isDatabaseConfigured()) return null;
  const result = await query<PickRow>(
    `select id, competition_id, user_id, group_id, ticker,
            start_price, current_price, final_price, return_pct, submitted_at, locked_at
     from competition_picks
     where competition_id = $1 and user_id = $2
     limit 1`,
    [competitionId, userId],
  );
  const row = result.rows[0];
  return row ? mapPick(row) : null;
}

export async function userMembershipGroupIds(userId: string): Promise<string[]> {
  if (!userId || !isDatabaseConfigured()) return [];
  const result = await query<{ group_id: string }>(
    `select group_id from user_group_memberships where user_id = $1`,
    [userId],
  );
  return result.rows.map((row) => row.group_id);
}

export async function submitPick(input: {
  competitionId: string;
  userId: string;
  groupId: string;
  ticker: string;
}): Promise<CompetitionPick> {
  if (!isDatabaseConfigured()) {
    throw new Error("Database required to submit picks.");
  }
  const ticker = input.ticker.trim().toUpperCase();
  if (!ticker) throw new Error("Ticker required.");

  const comp = await query<CompetitionRow>(
    `select id, group_a_id, group_b_id, period_start, period_end, status, metric, locked_at, winner_group_id
     from competitions where id = $1 limit 1`,
    [input.competitionId],
  );
  const row = comp.rows[0];
  if (!row) throw new Error("Competition not found.");
  const competition = mapCompetition(row);
  const lockAt = row.locked_at ?? weekWindowContaining(new Date(competition.periodStart)).lockAt;
  if (!isSubmissionOpen(competition.status, lockAt)) {
    throw new Error("Pick window is closed.");
  }
  if (input.groupId !== competition.groupAId && input.groupId !== competition.groupBId) {
    throw new Error("Join one of the competing communities to participate.");
  }

  const memberships = await userMembershipGroupIds(input.userId);
  if (!memberships.includes(input.groupId)) {
    throw new Error("Join the community before submitting a pick.");
  }

  const result = await query<PickRow>(
    `insert into competition_picks (competition_id, user_id, group_id, ticker)
     values ($1, $2, $3, $4)
     on conflict (competition_id, user_id) do update set
       group_id = excluded.group_id,
       ticker = excluded.ticker,
       updated_at = now()
     returning id, competition_id, user_id, group_id, ticker,
               start_price, current_price, final_price, return_pct, submitted_at, locked_at`,
    [input.competitionId, input.userId, input.groupId, ticker],
  );
  return mapPick(result.rows[0]);
}

export async function buildHeadToHeadPayload(input: {
  userId?: string;
  groupAId?: string | null;
  groupBId?: string | null;
}): Promise<HeadToHeadPayload> {
  const schools = await listHeadToHeadSchools();
  const primaryGroup = input.userId ? await getPrimaryGroupForUser(input.userId) : null;
  const viewerPrimaryGroupId = primaryGroup?.id ?? null;
  const defaults = pickDefaultH2HPair(schools, viewerPrimaryGroupId);

  const requestedA = input.groupAId?.trim() || defaults.groupAId;
  const requestedB = input.groupBId?.trim() || defaults.groupBId;
  const schoolIds = new Set(schools.map((school) => school.groupId));
  const groupAId = schoolIds.has(requestedA) ? requestedA : defaults.groupAId;
  const groupBId =
    schoolIds.has(requestedB) && requestedB !== groupAId
      ? requestedB
      : pickDefaultH2HPair(schools, groupAId).groupBId;

  const empty = (viewer: CompetitionViewerState): HeadToHeadPayload => ({
    available: false,
    competition: null,
    groupA: null,
    groupB: null,
    statusLabel: "",
    viewer,
    schools,
    viewerPrimaryGroupId,
  });

  if (!groupAId || !groupBId || groupAId === groupBId) {
    return empty(input.userId ? { kind: "not_member", message: "Pick two schools to compare." } : { kind: "guest" });
  }

  const [metaA, metaB, campusA, campusB] = await Promise.all([
    groupMeta(groupAId),
    groupMeta(groupBId),
    scoreCampusSide(groupAId),
    scoreCampusSide(groupBId),
  ]);

  const groupA: CompetitionGroupSide = {
    groupId: groupAId,
    name: metaA.name,
    primaryColor: metaA.primaryColor,
    domain: metaA.domain,
    ncaaId: metaA.ncaaId,
    accentColor: metaA.accentColor,
    avgReturnPct: campusA.avgReturnPct,
    pickCount: campusA.pickCount,
  };
  const groupB: CompetitionGroupSide = {
    groupId: groupBId,
    name: metaB.name,
    primaryColor: metaB.primaryColor,
    domain: metaB.domain,
    ncaaId: metaB.ncaaId,
    accentColor: metaB.accentColor,
    avgReturnPct: campusB.avgReturnPct,
    pickCount: campusB.pickCount,
  };

  let viewer: CompetitionViewerState = { kind: "guest" };
  if (input.userId) {
    const memberships = await userMembershipGroupIds(input.userId);
    const side =
      memberships.find((id) => id === groupAId || id === groupBId) ?? null;
    if (!side) {
      viewer = {
        kind: "not_member",
        message: "Join one of these schools — your My Pick counts toward that campus.",
      };
    } else {
      viewer = { kind: "member", groupId: side };
    }
  }

  return {
    available: true,
    competition: null,
    groupA,
    groupB,
    statusLabel: "Live",
    viewer,
    schools,
    viewerPrimaryGroupId,
  };
}
