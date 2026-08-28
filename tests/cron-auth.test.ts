import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

/**
 * Avoid importing cron-auth directly — it pulls next-auth via getOptionalSession,
 * which breaks under Vitest's Node resolution. Guard the wiring in source instead.
 */
describe("cron / admin / refresh auth wiring", () => {
  it("fails closed on cron and gates full evidence refresh", () => {
    const auth = read("src/lib/api/cron-auth.ts");
    const cron = read("src/app/api/cron/daily-sync/route.ts");
    const refresh = read("src/app/api/evidence/refresh/route.ts");
    const admin = read("src/app/api/admin/resources/route.ts");

    expect(auth).toContain("requireCronSecret");
    expect(auth).toContain("CRON_SECRET is not configured");
    expect(auth).toContain("requireAdminAccess");
    expect(cron).toContain("requireCronSecret(request)");
    expect(cron).toContain("Authorization: `Bearer ${cronSecret}`");
    expect(refresh).toContain("requireCronSecret(request)");
    expect(refresh).toContain("if (!ticker)");
    expect(admin).toContain("requireAdminAccess(request)");
  });
});
