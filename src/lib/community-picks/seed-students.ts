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

  const scale = seedRangeScale(range);

  return listSeedCanonicalCommunities()
    .map((group) => {
      const institution = SEED_INSTITUTIONS.find((row) => row.id === group.institutionId);
      const ncaaId = institution?.ncaaId ?? null;
      const members = byGroup.get(group.id) ?? [];
      const returns = members.map(
        (member) => Math.round((member.bankedGrowthFactor - 1) * 100 * scale * 100) / 100,
      );
      const avg =
        returns.length === 0
          ? null
          : Math.round((returns.reduce((sum, value) => sum + value, 0) / returns.length) * 100) / 100;
      const pickCount = members.length;
      return {
        groupId: group.id,
        name: group.name,
        primaryColor: group.primaryColor,
        domain: institution?.canonicalDomain ?? resolveNcaaDomain(ncaaId),
        ncaaId,
        accentColor: institution?.accentColor ?? group.primaryColor,
        pickCount,
        avgReturnPct: avg,
        ranked: pickCount >= MIN_RANKED_MEMBERS && avg !== null,
      };
    })
    .sort((a, b) => {
      if (a.ranked !== b.ranked) return a.ranked ? -1 : 1;
      if (a.avgReturnPct === null && b.avgReturnPct !== null) return 1;
      if (a.avgReturnPct !== null && b.avgReturnPct === null) return -1;
      if (a.avgReturnPct !== b.avgReturnPct) {
        return (b.avgReturnPct ?? 0) - (a.avgReturnPct ?? 0);
      }
      return a.name.localeCompare(b.name);
    });
}
