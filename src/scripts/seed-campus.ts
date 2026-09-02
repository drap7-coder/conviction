/**
 * Upsert 5 demo students × 15 seeded schools into Neon.
 * Usage: DATABASE_URL=... npm run seed:campus
 */
import {
  countCampusSeedUsersInDb,
  ensureCampusPickSeeds,
} from "../lib/community-picks/ensure-seeds";
import { listCampusSeedStudents } from "../lib/community-picks/seed-students";
import { isDatabaseConfigured } from "../lib/db";

async function main() {
  if (!isDatabaseConfigured()) {
    const students = listCampusSeedStudents();
    console.error("DATABASE_URL is not set — cannot seed campus picks into Neon.");
    console.error(
      `Without a database, Community standings still serves ${students.length} in-memory seed students across ${new Set(students.map((s) => s.groupId)).size} schools.`,
    );
    process.exit(1);
  }

  const result = await ensureCampusPickSeeds();
  const count = await countCampusSeedUsersInDb();
  console.log(
    JSON.stringify(
      {
        ok: true,
        seeded: result.seeded,
        studentCount: result.studentCount,
        schoolCount: result.schoolCount,
        seedUsersInDb: count,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
