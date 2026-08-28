/**
 * Upsert the ten Crowd starter books into Neon.
 * Usage: DATABASE_URL=... npx tsx scripts/seed-crowd.ts
 * (or: node --import tsx scripts/seed-crowd.ts)
 */
import { ensureCrowdSeedBooks, countCrowdSeedUsersInDb } from "../lib/crowd/ensure-seeds";
import { isDatabaseConfigured } from "../lib/db";

async function main() {
  if (!isDatabaseConfigured()) {
    console.error("DATABASE_URL is not set — cannot seed Crowd books into Neon.");
    console.error("Without a database, Crowd still serves the ten in-memory starter books.");
    process.exit(1);
  }

  const result = await ensureCrowdSeedBooks();
  const count = await countCrowdSeedUsersInDb();
  console.log(
    JSON.stringify(
      {
        ok: true,
        seeded: result.seeded,
        bookCount: result.bookCount,
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
