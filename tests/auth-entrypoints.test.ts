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

describe("authentication entry points", () => {
  it("opens the Auth.js sign-in page instead of GETing a provider action", () => {
    expect(guestBanner).toContain('href="/api/auth/signin"');
    expect(navConfig).toContain('href: "/api/auth/signin"');
    expect(guestBanner).not.toContain('href="/api/auth/signin/github"');
    expect(navConfig).not.toContain('href: "/api/auth/signin/github"');
  });
});
