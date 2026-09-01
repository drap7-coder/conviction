import { isDatabaseConfigured, query } from "@/lib/db";
import { findSeedGroupById } from "@/lib/groups/seed-groups";
import { findSeedInstitutionById } from "@/lib/groups/seed-institutions";
import type {
  Competition,
  CompetitionGroupSide,
  CompetitionPick,
  CompetitionStatus,
  HeadToHeadPayload,
  CompetitionViewerState,
} from "@/lib/competitions/types";
import {
  competitionStatusLabel,
  isSubmissionOpen,
  weekWindowContaining,
} from "@/lib/competitions/schedule";
import { computeSideScore, countSubmittedPicks } from "@/lib/competitions/scores";

/** Platform-seeded rivalries — data-driven, not hardcoded in UI. */
export const RIVALRY_PAIRS: Array<{ groupAId: string; groupBId: string; slug: string }> = [
  { groupAId: "group-wm", groupBId: "group-rpi", slug: "wm-rpi" },
  { groupAId: "group-njit", groupBId: "group-stevens", slug: "njit-stevens" },
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

async function groupMeta(
  groupId: string,
): Promise<{ name: string; primaryColor: string | null; accentColor: string | null }> {
  const seed = findSeedGroupById(groupId);
  if (seed) {
    const institution = findSeedInstitutionById(seed.institutionId);
    return {
      name: seed.name,
      primaryColor: seed.primaryColor,
      accentColor: institution?.accentColor ?? seed.primaryColor,
    };
  }
  if (!isDatabaseConfigured()) return { name: groupId, primaryColor: null, accentColor: null };
  try {
    const result = await query<{
      name: string;
      primary_color: string | null;
      accent_color: string | null;
    }>(
      `select g.name, g.primary_color, i.accent_color
       from groups g
       left join institutions i on i.id = g.institution_id
       where g.id = $1
       limit 1`,
      [groupId],
    );
    const row = result.rows[0];
    return {
      name: row?.name ?? groupId,
      primaryColor: row?.primary_color ?? null,
      accentColor: row?.accent_color ?? row?.primary_color ?? null,
    };
  } catch {
    return { name: groupId, primaryColor: null, accentColor: null };
  }
}

function pairMatchesCompetition(
  pair: (typeof RIVALRY_PAIRS)[number],
  competition: Competition,
): boolean {
  return (
    (competition.groupAId === pair.groupAId && competition.groupBId === pair.groupBId) ||
    (competition.groupAId === pair.groupBId && competition.groupBId === pair.groupAId)
  );
}

export async function listActiveCompetitions(): Promise<Competition[]> {
  if (!isDatabaseConfigured()) return [];
  await ensureWeeklyCompetitions();
  const result = await query<CompetitionRow>(
    `select id, group_a_id, group_b_id, period_start, period_end, status, metric, locked_at, winner_group_id
     from competitions
     where status in ('open', 'live', 'final')
     order by period_start desc`,
  );
  return result.rows.map((row) => mapCompetition(row));
}

export async function resolveActiveCompetition(scopeGroupIds: string[] = []): Promise<Competition | null> {
  const competitions = await listActiveCompetitions();
  if (competitions.length === 0) return null;

  if (scopeGroupIds.length > 0) {
    for (const competition of competitions) {
      const sideIds = [competition.groupAId, competition.groupBId];
      if (scopeGroupIds.some((id) => sideIds.includes(id))) {
        return competition;
      }
    }
  }

  for (const pair of RIVALRY_PAIRS) {
    const featured = competitions.find((competition) => pairMatchesCompetition(pair, competition));
    if (featured) return featured;
  }

  return null;
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

export async function getActiveCompetition(scopeGroupIds: string[] = []): Promise<Competition | null> {
  return resolveActiveCompetition(scopeGroupIds);
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
  scopeGroupIds?: string[];
}): Promise<HeadToHeadPayload> {
  const scopeGroupIds =
    input.scopeGroupIds ??
    (input.userId ? await userMembershipGroupIds(input.userId) : []);

  const competition = await resolveActiveCompetition(scopeGroupIds);
  if (!competition) {
    return {
      available: false,
      competition: null,
      groupA: null,
      groupB: null,
      statusLabel: "",
      viewer: { kind: "guest" },
    };
  }

  const window = weekWindowContaining(new Date(competition.periodStart));
  const lockAt = competition.lockedAt ? new Date(competition.lockedAt) : window.lockAt;
  const periodEnd = new Date(competition.periodEnd);
  const statusLabel = competitionStatusLabel(
    competition.status,
    lockAt,
    periodEnd,
  );

  const picks = await listPicksForCompetition(competition.id);
  const [metaA, metaB] = await Promise.all([
    groupMeta(competition.groupAId),
    groupMeta(competition.groupBId),
  ]);

  const groupA: CompetitionGroupSide = {
    groupId: competition.groupAId,
    name: metaA.name,
    primaryColor: metaA.primaryColor,
    accentColor: metaA.accentColor,
    avgReturnPct: computeSideScore(picks, competition.groupAId).avgReturnPct,
    pickCount: countSubmittedPicks(picks, competition.groupAId),
  };
  const groupB: CompetitionGroupSide = {
    groupId: competition.groupBId,
    name: metaB.name,
    primaryColor: metaB.primaryColor,
    accentColor: metaB.accentColor,
    avgReturnPct: computeSideScore(picks, competition.groupBId).avgReturnPct,
    pickCount: countSubmittedPicks(picks, competition.groupBId),
  };

  let viewer: CompetitionViewerState = { kind: "guest" };
  if (input.userId) {
    const memberships = await userMembershipGroupIds(input.userId);
    const side =
      memberships.find(
        (id) => id === competition.groupAId || id === competition.groupBId,
      ) ?? null;
    const existing = picks.find((p) => p.userId === input.userId) ?? null;
    if (!side) {
      viewer = { kind: "not_member", message: "Join Group to Participate" };
    } else if (existing?.lockedAt) {
      viewer = {
        kind: "locked_pick",
        ticker: existing.ticker,
        returnPct: existing.returnPct,
        groupId: existing.groupId,
      };
    } else if (isSubmissionOpen(competition.status, lockAt)) {
      viewer = {
        kind: "can_submit",
        groupId: side,
        existingTicker: existing?.lockedAt ? null : existing?.ticker ?? null,
      };
    } else if (existing) {
      viewer = {
        kind: "locked_pick",
        ticker: existing.ticker,
        returnPct: existing.returnPct,
        groupId: existing.groupId,
      };
    } else {
      viewer = { kind: "not_member", message: "Pick window closed." };
    }
  }

  return {
    available: true,
    competition,
    groupA,
    groupB,
    statusLabel,
    viewer,
  };
}
