/**
 * Public build marker for `?debug=1`.
 * On Vercel, `next.config.ts` copies `VERCEL_GIT_COMMIT_SHA` into
 * `NEXT_PUBLIC_BUILD_ID` at build time so the client can show the SHA.
 */
export function resolvePublicBuildId(
  env: Record<string, string | undefined> = process.env,
): string {
  const explicit = env.NEXT_PUBLIC_BUILD_ID?.trim();
  if (explicit) return explicit;
  const sha = env.VERCEL_GIT_COMMIT_SHA?.trim();
  if (sha) return sha;
  return "dev";
}

export function formatBuildId(id: string): string {
  const trimmed = id.trim() || "dev";
  if (trimmed === "dev") return "dev";
  return trimmed.length > 7 ? trimmed.slice(0, 7) : trimmed;
}

export function isDebugQuery(value: string | null | undefined): boolean {
  return value === "1";
}
