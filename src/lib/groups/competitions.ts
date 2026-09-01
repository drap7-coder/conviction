import { isDatabaseConfigured, query } from "@/lib/db";
import { SEED_GROUPS } from "@/lib/groups/seed-groups";
import {
  averagesTied,
  isCompetitionPickWindowOpen,
  msUntil,
} from "@/lib/groups/pick-window";
import type {
  Competition,
  CompetitionPick,
  CompetitionSideStats,
  CompetitionStanding,
  Group,
} from "@/lib/groups/types";
import { sanitizeWatchlistSymbol } from "@/lib/watchlist/sanitize-ticker";
import { validateTicker } from "@/lib/watchlist/validate";

type CompetitionRow = {
  id: string;
  group_a_id: string;
  group_b_id: string;
  period_start: string;
  period_end: string;
  metric: "avg_pct_return";
};

type PickRow = {
  id: string;
  competition_id: string;
  user_id: string;
  group_id: string;
  ticker: string;
  submitted_at: string;
  updated_at: string;
};

function mapCompetition(row: CompetitionRow): Competition {
  return {
    id: row.id,
    groupAId: row.group_a_id,
    groupBId: row.group_b_id,
    periodStart: new Date(row.period_start).toISOString(),
    periodEnd: new Date(row.period_end).toISOString(),
    metric: row.metric,
  };
}

function mapPick(row: PickRow): CompetitionPick {
  return {
    id: row.id,
    competitionId: row.competition_id,
    userId: row.user_id,
    groupId: row.group_id,
    ticker: row.ticker,
    submittedAt: new Date(row.submitted_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

/** Demo competition spanning the current Mon–Fri ET week. */
export function buildSeedCompetition(now = new Date()): Competition {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(now);
  const value = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const y = Number(value("year"));
  const m = Number(value("month"));
  const d = Number(value("day"));
  const weekday = value("weekday");
  // Approximate Monday of this week in ET calendar date.
  const dayOffset: Record<string, number> = {
    Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
  };
  const offset = dayOffset[weekday] ?? 0;
  const mondayUtc = Date.UTC(y, m - 1, d - offset, 13, 30, 0); // ~9:30 ET
  const fridayUtc = Date.UTC(y, m - 1, d - offset + 4, 20, 0, 0); // ~16:00 ET Fri
  return {
    id: "competition-seed-wm-uva",
    groupAId: "group-seed-wm",
    groupBId: "group-seed-uva",
    periodStart: new Date(mondayUtc).toISOString(),
    periodEnd: new Date(fridayUtc).toISOString(),
    metric: "avg_pct_return",
  };
}

/** Seed pick returns — only active pickers contribute (no zero-fill). */
const SEED_PICK_RETURNS: Record<string, Array<{ groupId: string; pct: number }>> = {
  "competition-seed-wm-uva": [
    { groupId: "group-seed-wm", pct: 1.8 },
    { groupId: "group-seed-wm", pct: 0.6 },
    { groupId: "group-seed-wm", pct: -0.4 },
    { groupId: "group-seed-uva", pct: 1.2 },
    { groupId: "group-seed-uva", pct: 0.9 },
  ],
};

function sideStats(
  group: Group,
  returns: number[],
): CompetitionSideStats {
  if (returns.length === 0) {
    return {
      groupId: group.id,
      groupName: group.name,
      primaryColor: group.primaryColor,
      avgPctReturn: null,
      pickCount: 0,
    };
  }
  const sum = returns.reduce((acc, value) => acc + value, 0);
  return {
    groupId: group.id,
    groupName: group.name,
    primaryColor: group.primaryColor,
    avgPctReturn: Math.round((sum / returns.length) * 100) / 100,
    pickCount: returns.length,
  };
}

export function buildStandingFromReturns(input: {
  competition: Competition;
  groupA: Group;
  groupB: Group;
  returnsA: number[];
  returnsB: number[];
  now?: Date;
}): CompetitionStanding {
  const now = input.now ?? new Date();
  const groupA = sideStats(input.groupA, input.returnsA);
  const groupB = sideStats(input.groupB, input.returnsB);
  const isTie = averagesTied(groupA.avgPctReturn, groupB.avgPctReturn);
  let leaderGroupId: string | null = null;
  if (!isTie && groupA.avgPctReturn !== null && groupB.avgPctReturn !== null) {
    leaderGroupId =
      groupA.avgPctReturn > groupB.avgPctReturn ? groupA.groupId : groupB.groupId;
  } else if (groupA.avgPctReturn !== null && groupB.avgPctReturn === null) {
    leaderGroupId = groupA.groupId;
  } else if (groupB.avgPctReturn !== null && groupA.avgPctReturn === null) {
    leaderGroupId = groupB.groupId;
  }

  return {
    competition: input.competition,
    groupA,
    groupB,
    isTie,
    leaderGroupId,
    msRemaining: msUntil(input.competition.periodEnd, now),
    picksLocked: !isCompetitionPickWindowOpen(now),
  };
}

export async function listActiveCompetitionStandings(
  now = new Date(),
): Promise<CompetitionStanding[]> {
  if (!isDatabaseConfigured()) {
    return seedStanding(now);
  }

  try {
    const comps = await query<CompetitionRow>(
      `select id, group_a_id, group_b_id, period_start, period_end, metric
       from competitions
       where period_end >= $1
       order by period_start asc
       limit 12`,
      [now.toISOString()],
    );
    if (comps.rows.length === 0) {
      return seedStanding(now);
    }

    const standings: CompetitionStanding[] = [];
    for (const row of comps.rows) {
      const competition = mapCompetition(row);
      const groups = await query<{ id: string; name: string; type: "school" | "org"; primary_color: string | null }>(
        `select id, name, type, primary_color from groups where id = any($1::text[])`,
        [[competition.groupAId, competition.groupBId]],
      );
      const byId = new Map(
        groups.rows.map((g) => [
          g.id,
          {
            id: g.id,
            name: g.name,
            type: g.type,
            primaryColor: g.primary_color,
          } satisfies Group,
        ]),
      );
      const groupA = byId.get(competition.groupAId);
      const groupB = byId.get(competition.groupBId);
      if (!groupA || !groupB) continue;

      // Active picks only — averages stay null until a daily MTM job fills returns.
      // Seed demo competition keeps illustrative active-pick averages.
      if (competition.id === "competition-seed-wm-uva") {
        const seedPicks = SEED_PICK_RETURNS[competition.id] ?? [];
        standings.push(
          buildStandingFromReturns({
            competition,
            groupA,
            groupB,
            returnsA: seedPicks.filter((p) => p.groupId === groupA.id).map((p) => p.pct),
            returnsB: seedPicks.filter((p) => p.groupId === groupB.id).map((p) => p.pct),
            now,
          }),
        );
        continue;
      }

      standings.push(
        buildStandingFromReturns({
          competition,
          groupA,
          groupB,
          returnsA: [],
          returnsB: [],
          now,
        }),
      );
    }

    return standings.length > 0 ? standings : seedStanding(now);
  } catch {
    return seedStanding(now);
  }
}

function seedStanding(now: Date): CompetitionStanding[] {
  const competition = buildSeedCompetition(now);
  const groupA = SEED_GROUPS.find((g) => g.id === competition.groupAId)!;
  const groupB = SEED_GROUPS.find((g) => g.id === competition.groupBId)!;
  const picks = SEED_PICK_RETURNS[competition.id] ?? [];
  return [
    buildStandingFromReturns({
      competition,
      groupA,
      groupB,
      returnsA: picks.filter((p) => p.groupId === groupA.id).map((p) => p.pct),
      returnsB: picks.filter((p) => p.groupId === groupB.id).map((p) => p.pct),
      now,
    }),
  ];
}

export async function submitCompetitionPick(input: {
  userId: string;
  competitionId: string;
  groupId: string;
  ticker: string;
  now?: Date;
}): Promise<CompetitionPick> {
  const now = input.now ?? new Date();
  if (!isCompetitionPickWindowOpen(now)) {
    throw new Error("Picks are locked until the weekend window opens.");
  }

  const symbol = sanitizeWatchlistSymbol(input.ticker);
  if (!symbol) throw new Error("Enter a valid ticker from the app universe.");
  const validated = await validateTicker(symbol);
  if (!validated.valid || !validated.ticker) {
    throw new Error(validated.error ?? "Ticker is not in the validated universe.");
  }
  const ticker = validated.ticker.toUpperCase();

  if (!isDatabaseConfigured()) {
    return {
      id: `pick-local-${Date.now()}`,
      competitionId: input.competitionId,
      userId: input.userId,
      groupId: input.groupId,
      ticker,
      submittedAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
  }

  // Bind to the group_id at submit time — membership drift mid-week is ignored.
  const result = await query<PickRow>(
    `insert into competition_picks (competition_id, user_id, group_id, ticker, submitted_at, updated_at)
     values ($1, $2, $3, $4, $5, $5)
     on conflict (competition_id, user_id, group_id)
     do update set ticker = excluded.ticker, updated_at = excluded.updated_at
     returning id, competition_id, user_id, group_id, ticker, submitted_at, updated_at`,
    [input.competitionId, input.userId, input.groupId, ticker, now.toISOString()],
  );
  return mapPick(result.rows[0]);
}
