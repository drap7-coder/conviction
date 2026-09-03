/**
 * Demo campus members for Community standings.
 * Five students per seeded school (15 schools → 75 members) so every campus
 * clears {@link MIN_RANKED_MEMBERS} once live quotes resolve.
 */

import { listSeedCanonicalCommunities } from "@/lib/groups/seed-groups";
import { SEED_INSTITUTIONS } from "@/lib/groups/seed-institutions";
import { MIN_RANKED_MEMBERS } from "@/lib/community-picks/constants";
import type { CommunityStanding } from "@/lib/community-picks/types";
import {
  DEFAULT_H2H_PERF_RANGE,
  seedRangeScale,
  type H2HPerfRange,
} from "@/lib/competitions/perf-range";
import { resolveNcaaDomain } from "@/lib/groups/ncaa-domains";
import { averageLifetimeReturnPct, lifetimeReturnPct } from "@/lib/community-picks/growth";
import type { CallSlot } from "@/lib/community-picks/call-slots";

export const CAMPUS_SEED_ID_PREFIX = "campus-seed-";

/** Students per campus — matches ranking threshold. */
export const CAMPUS_SEED_STUDENTS_PER_SCHOOL = MIN_RANKED_MEMBERS;

const PICK_UNIVERSE = [
  { ticker: "NVDA", entryPrice: 118 },
  { ticker: "AAPL", entryPrice: 188 },
  { ticker: "MSFT", entryPrice: 410 },
  { ticker: "META", entryPrice: 490 },
  { ticker: "GOOG", entryPrice: 165 },
  { ticker: "AMZN", entryPrice: 175 },
  { ticker: "AVGO", entryPrice: 145 },
  { ticker: "AMD", entryPrice: 122 },
  { ticker: "JPM", entryPrice: 195 },
  { ticker: "XOM", entryPrice: 108 },
  { ticker: "JNJ", entryPrice: 152 },
  { ticker: "VTI", entryPrice: 255 },
  { ticker: "QQQ", entryPrice: 460 },
  { ticker: "COST", entryPrice: 780 },
  { ticker: "TSLA", entryPrice: 240 },
] as const;

// These match the "extra legs" logic in `ensure-seeds.ts` so guest/no-DB mode
// can still show a complete $100k portfolio for seeded members.
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

export type CampusSeedStudent = {
  id: string;
  label: string;
  groupId: string;
  institutionId: string;
  ticker: string;
  entryPrice: number;
  /** Optional banked growth so campuses sort differently before/with quotes. */
  bankedGrowthFactor: number;
};

export function isCampusSeedUserId(userId: string): boolean {
  return userId.startsWith(CAMPUS_SEED_ID_PREFIX);
}

export function campusSeedEmail(id: string): string {
  return `${id}@seed.gotconviction.internal`;
}

/** Deterministic 5 students × each seeded school. */
export function listCampusSeedStudents(): CampusSeedStudent[] {
  const schools = listSeedCanonicalCommunities();
  const students: CampusSeedStudent[] = [];

  schools.forEach((group, schoolIndex) => {
    for (let seat = 0; seat < CAMPUS_SEED_STUDENTS_PER_SCHOOL; seat += 1) {
      const pick = PICK_UNIVERSE[(schoolIndex * CAMPUS_SEED_STUDENTS_PER_SCHOOL + seat) % PICK_UNIVERSE.length];
      const id = `${CAMPUS_SEED_ID_PREFIX}${group.inviteCode ?? group.id}-${String(seat + 1).padStart(2, "0")}`;
      // Mild banked edge so schools don't all average the same before quotes move.
      const bankedGrowthFactor = 1 + ((schoolIndex * 3 + seat) % 9) * 0.01;
      students.push({
        id,
        label: `${group.name} student ${seat + 1}`,
        groupId: group.id,
        institutionId: group.institutionId,
        ticker: pick.ticker,
        entryPrice: pick.entryPrice,
        bankedGrowthFactor,
      });
    }
  });

  return students;
}

export type CampusSeedLeg = {
  callSlot: CallSlot;
  /** User-facing identity stored in `community_picks` (ticker or BITCOIN/GOLD/…). */
  ticker: string;
  entryPrice: number;
};

let cachedSeedStudents: CampusSeedStudent[] | null = null;
function getSeedStudentsCached(): CampusSeedStudent[] {
  if (!cachedSeedStudents) cachedSeedStudents = listCampusSeedStudents();
  return cachedSeedStudents;
}

/**
 * Deterministic 5-call "board legs" for a seeded member.
 *
 * In DB mode, the Portfolio page reads real `portfolio_positions` rows.
 * In guest/no-DB mode, we synthesize positions from these legs so seeded
 * members still have complete, non-empty portfolios to inspect.
 */
export function campusSeedLegsForUser(userId: string): CampusSeedLeg[] | null {
  if (!isCampusSeedUserId(userId)) return null;

  const students = getSeedStudentsCached();
  const student = students.find((s) => s.id === userId);
  if (!student) return null;

  // `listCampusSeedStudents` suffixes ids with a padded seat index: 01..05.
  const parsedSeatFromId = Number(userId.slice(-2)) - 1;
  const seatsInSameGroup = students.filter((s) => s.groupId === student.groupId);
  const seatFromOrdering = seatsInSameGroup.findIndex((s) => s.id === student.id);
  const seatResolved =
    seatFromOrdering >= 0
      ? seatFromOrdering
      : Number.isFinite(parsedSeatFromId)
        ? parsedSeatFromId
        : 0;

  const seatResolvedSafe =
    ((seatResolved % CAMPUS_SEED_STUDENTS_PER_SCHOOL) + CAMPUS_SEED_STUDENTS_PER_SCHOOL) % CAMPUS_SEED_STUDENTS_PER_SCHOOL;

  const stock2 = PICK_UNIVERSE_SECOND[seatResolvedSafe % PICK_UNIVERSE_SECOND.length]!;
  const stock3 = PICK_UNIVERSE_THIRD[seatResolvedSafe % PICK_UNIVERSE_THIRD.length]!;
  const macroBtcGold = seatResolvedSafe % 2 === 0 ? "BITCOIN" : "GOLD";
  const macroBtcGoldEntry = seatResolvedSafe % 2 === 0 ? 65000 : 220;
  const macroIntl = INTL_SEED_IDS[seatResolvedSafe % INTL_SEED_IDS.length]!;

  return [
    { callSlot: "STOCK_1", ticker: student.ticker, entryPrice: student.entryPrice },
    { callSlot: "STOCK_2", ticker: stock2.ticker, entryPrice: stock2.entryPrice },
    { callSlot: "STOCK_3", ticker: stock3.ticker, entryPrice: stock3.entryPrice },
    { callSlot: "BTC_GOLD", ticker: macroBtcGold, entryPrice: macroBtcGoldEntry },
    { callSlot: "INTERNATIONAL", ticker: macroIntl, entryPrice: 50 },
  ];
}

/** Offline / no-DB standings so guest Standings still shows a full board. */
export function seedCampusStandings(
  range: H2HPerfRange = DEFAULT_H2H_PERF_RANGE,
): CommunityStanding[] {
  const students = listCampusSeedStudents();
  const byGroup = new Map<string, CampusSeedStudent[]>();
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
      const pickCount = members.length;
      const bankedReturns = members.map((m) => lifetimeReturnPct(m.bankedGrowthFactor));
      const avgBankedReturnPct = averageLifetimeReturnPct(bankedReturns) ?? 0;
      return {
        groupId: group.id,
        name: group.name,
        primaryColor: group.primaryColor,
        domain: institution?.canonicalDomain ?? resolveNcaaDomain(ncaaId),
        ncaaId,
        accentColor: institution?.accentColor ?? group.primaryColor,
        pickCount,
        // Guest/offline: scale the seeded banked edge so 1d/1w/1m/ytd don't look identical.
        avgReturnPct: avgBankedReturnPct * seedRangeScale(range),
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
