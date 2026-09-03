import { isDatabaseConfigured } from "@/lib/db";
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
 * Idempotent: apply any pending SQL migrations, then upsert platform seed
 * institutions/groups. Safe to call on community routes — runs at most once
 * per process. Always runs applyMigrations (tracked in schema_migrations) so
 * additive columns like call_slot land even when base tables already exist.
 */
export async function ensureCommunitySchema(
  options: EnsureCommunitySchemaOptions = {},
): Promise<void> {
  if (!isDatabaseConfigured()) return;

  if (!ready) {
    ready = (async () => {
      await applyMigrations();
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
