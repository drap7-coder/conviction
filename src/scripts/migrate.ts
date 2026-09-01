/**
 * Apply pending SQL migrations against DATABASE_URL.
 * Usage: npm run migrate
 */
import { applyMigrations } from "../lib/db/migrate";

async function main() {
  const result = await applyMigrations();
  console.log(
    JSON.stringify(
      {
        ok: true,
        applied: result.applied,
        skipped: result.skipped,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
