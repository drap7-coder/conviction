import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const guestBanner = readFileSync(
  new URL("../src/app/components/GuestModeBanner.tsx", import.meta.url),
  "utf8",
);
const navConfig = readFileSync(
  new URL("../src/lib/nav-config.ts", import.meta.url),
  "utf8",
);
const authConfig = readFileSync(
  new URL("../auth.ts", import.meta.url),
  "utf8",
);
const readiness = readFileSync(
  new URL("../src/lib/auth-readiness.ts", import.meta.url),
  "utf8",
);

describe("authentication entry points", () => {
  it("opens the Auth.js sign-in page instead of GETing a provider action", () => {
    expect(guestBanner).toContain('href="/api/auth/signin"');
    expect(navConfig).toContain('href: "/api/auth/signin"');
    expect(guestBanner).not.toContain('href="/api/auth/signin/github"');
    expect(navConfig).not.toContain('href: "/api/auth/signin/github"');
  });

  it("uses Google as the only identity provider", () => {
    expect(authConfig).toContain('import Google from "next-auth/providers/google"');
    expect(authConfig).toContain("providers: [Google]");
    expect(authConfig).not.toContain("GitHub");
    expect(authConfig).not.toContain("providers/github");
    expect(readiness).toContain('"AUTH_GOOGLE_ID"');
    expect(readiness).toContain('"AUTH_GOOGLE_SECRET"');
    expect(readiness).not.toContain("AUTH_GITHUB");
    expect(navConfig).toContain("Use Google to sync your data across devices.");
  });
});
