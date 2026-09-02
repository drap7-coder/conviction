import { isDatabaseConfigured, query } from "@/lib/db";
import { applyMigrations } from "@/lib/db/migrate";
import { ensureSeedGroups, ensureSeedInstitutions } from "@/lib/groups/store";
import { ensureNcaaInstitutionDirectory } from "@/lib/groups/institution-directory";

let ready: Promise<void> | null = null;
let directoryReady: Promise<void> | null = null;

export type EnsureCommunitySchemaOptions = {
  /**
   * Upsert the full NCAA directory (~1k schools). Expensive on cold process —
   * only needed for institution search / join / admin migrate, not hot GETs.
   */
  includeDirectory?: boolean;
};

/**
 * Idempotent: apply pending SQL migrations when community tables are missing,
 * then upsert platform seed institutions/groups. Safe to call on community
 * routes — runs migrations at most once per process.
 */
export async function ensureCommunitySchema(
  options: EnsureCommunitySchemaOptions = {},
): Promise<void> {
  if (!isDatabaseConfigured()) return;

  if (!ready) {
    ready = (async () => {
      const result = await query<{ ready: boolean }>(
        `select count(*) = 3 as ready
         from information_schema.tables
         where table_schema = 'public'
           and table_name in ('user_institution_memberships', 'community_picks', 'community_pick_history')`,
      );
      if (!result.rows[0]?.ready) {
        await applyMigrations();
      }
      await ensureSeedInstitutions();
      await ensureSeedGroups();
    })().catch((error) => {
      ready = null;
      throw error;
    });
  }

  await ready;

  if (options.includeDirectory) {
    if (!directoryReady) {
      directoryReady = ensureNcaaInstitutionDirectory().catch((error) => {
        directoryReady = null;
        throw error;
      });
    }
    await directoryReady;
  }
}

export function formatCommunityDbError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (
    message.includes("user_institution_memberships") ||
    message.includes("institutions") ||
    message.includes("does not exist")
  ) {
    return "Community database is still setting up. Wait a moment and try again.";
  }
  return message || "Community update failed";
}
