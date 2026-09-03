import { describe, expect, it } from "vitest";
import { listCampusSeedStudents } from "@/lib/community-picks/seed-students";
import { getUserPortfolio } from "@/lib/user-portfolio";
import { PLAYER_BANKROLL_USD } from "@/lib/community-picks/notional";

describe("campus-seed demo portfolios", () => {
  it("gives every seeded member a complete non-empty $100k portfolio in no-DB mode", async () => {
    const students = listCampusSeedStudents();
    // 15 seeded schools × 5 members each.
    expect(students.length).toBe(75);

    for (const student of students) {
      const positions = await getUserPortfolio(student.id);
      expect(positions.length).toBeGreaterThan(0);

      let totalCost = 0;
      for (const pos of positions) {
        expect(pos.shares).toBeGreaterThan(0);
        expect(pos.averageCost).toBeGreaterThan(0);
        totalCost += pos.shares * (pos.averageCost ?? 0);
      }

      // Derived positions are equal-weight across 5 legs:
      // ($100k / 5 per leg) × 5 legs = $100k total cost basis.
      expect(totalCost).toBeCloseTo(PLAYER_BANKROLL_USD, 6);
    }
  });
});

