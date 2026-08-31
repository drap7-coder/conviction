import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  adminEmailsConfigured,
  isAdminEmail,
  parseAdminEmails,
} from "@/lib/api/admin-access";
import {
  checkSingleTickerCooldown,
  checkSingleTickerIpLimit,
  clientIpFromRequest,
  resetSingleTickerIpLimitForTests,
} from "@/lib/api/refresh-rate-limit";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("admin allowlist", () => {
  afterEach(() => {
    delete process.env.ADMIN_EMAILS;
  });

  it("parses comma-separated emails case-insensitively", () => {
    process.env.ADMIN_EMAILS = " Owner@Example.com , ops@iqbulls.com,owner@example.com ";
    expect(parseAdminEmails()).toEqual(["owner@example.com", "ops@iqbulls.com"]);
    expect(adminEmailsConfigured()).toBe(true);
    expect(isAdminEmail("OWNER@example.com")).toBe(true);
    expect(isAdminEmail("guest@example.com")).toBe(false);
    expect(isAdminEmail(null)).toBe(false);
  });

  it("treats missing ADMIN_EMAILS as empty allowlist", () => {
    delete process.env.ADMIN_EMAILS;
    expect(parseAdminEmails()).toEqual([]);
    expect(adminEmailsConfigured()).toBe(false);
    expect(isAdminEmail("anyone@example.com")).toBe(false);
  });

  it("wires requireAdminAccess to the allowlist, not any signed-in user", () => {
    const auth = read("src/lib/api/cron-auth.ts");
    expect(auth).toContain("isAdminEmail");
    expect(auth).toContain("adminEmailsConfigured");
    expect(auth).toContain("admin allowlist only");
    expect(auth).toContain("timingSafeEqual");
    expect(auth).not.toMatch(/if \(session\?\.user\) return null;/);
  });
});

describe("single-ticker evidence refresh caps", () => {
  afterEach(() => {
    resetSingleTickerIpLimitForTests();
  });

  it("enforces a per-ticker cooldown from last fetch", () => {
    const now = Date.parse("2026-08-31T20:00:00.000Z");
    expect(checkSingleTickerCooldown(null, now)).toEqual({ ok: true });
    expect(
      checkSingleTickerCooldown("2026-08-31T19:56:00.000Z", now),
    ).toEqual({ ok: false, retryAfterSec: 60 });
    expect(
      checkSingleTickerCooldown("2026-08-31T19:54:00.000Z", now),
    ).toEqual({ ok: true });
  });

  it("enforces a per-IP burst window", () => {
    const now = Date.parse("2026-08-31T20:00:00.000Z");
    for (let i = 0; i < 6; i += 1) {
      expect(checkSingleTickerIpLimit("1.2.3.4", now).ok).toBe(true);
    }
    const blocked = checkSingleTickerIpLimit("1.2.3.4", now);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterSec).toBeGreaterThan(0);

    expect(checkSingleTickerIpLimit("9.9.9.9", now).ok).toBe(true);
  });

  it("reads the first X-Forwarded-For hop", () => {
    const headers = new Headers({
      "x-forwarded-for": " 203.0.113.10, 10.0.0.1 ",
    });
    expect(clientIpFromRequest(headers)).toBe("203.0.113.10");
  });

  it("applies caps on the refresh route unless cron bearer is present", () => {
    const refresh = read("src/app/api/evidence/refresh/route.ts");
    expect(refresh).toContain("checkSingleTickerCooldown");
    expect(refresh).toContain("checkSingleTickerIpLimit");
    expect(refresh).toContain("cronAuthorized");
    expect(refresh).toContain("getLastFetchTime");
    expect(refresh).toContain("Retry-After");
  });
});

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
    const agents = read("AGENTS.md");
    const envExample = read(".env.example");

    expect(auth).toContain("requireCronSecret");
    expect(auth).toContain("CRON_SECRET is not configured");
    expect(auth).toContain("requireAdminAccess");
    expect(cron).toContain("requireCronSecret(request)");
    expect(cron).toContain("Authorization: `Bearer ${cronSecret}`");
    expect(cron).toContain("SITE_URL");
    expect(cron).not.toContain("process.env.VERCEL_URL");
    expect(refresh).toContain("requireCronSecret(request)");
    expect(refresh).toContain("if (!ticker)");
    expect(admin).toContain("requireAdminAccess(request)");
    expect(admin).toContain("ADMIN_EMAILS");
    expect(envExample).toContain("ADMIN_EMAILS=");
    expect(agents).toContain("ADMIN_EMAILS");
    expect(agents).toContain("rate-capped");
    expect(agents).not.toContain("Compare against pills + Trim/Add");
    expect(agents).toContain("no Compare-against pills and no Trim/Add moves");
  });
});
