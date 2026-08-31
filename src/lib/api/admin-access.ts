/**
 * Admin allowlist for ops routes.
 *
 * Cron Bearer (`CRON_SECRET`) always works.
 * Signed-in sessions only when the user's email is in `ADMIN_EMAILS`
 * (comma-separated, case-insensitive). Any other signed-in user is denied.
 */

export function parseAdminEmails(raw = process.env.ADMIN_EMAILS): string[] {
  if (!raw?.trim()) return [];
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

export function adminEmailsConfigured(): boolean {
  return parseAdminEmails().length > 0;
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email?.trim()) return false;
  const normalized = email.trim().toLowerCase();
  return parseAdminEmails().includes(normalized);
}
