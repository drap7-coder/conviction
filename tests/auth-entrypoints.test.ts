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
const signInPage = readFileSync(
  new URL("../src/app/signin/page.tsx", import.meta.url),
  "utf8",
);

describe("authentication entry points", () => {
  it("opens the branded account page instead of GETing a provider action", () => {
    expect(guestBanner).toContain('href="/signin"');
    expect(navConfig).toContain('href: "/signin"');
    expect(authConfig).toContain('pages: { signIn: "/signin" }');
    expect(guestBanner).not.toContain('href="/api/auth/signin/github"');
    expect(navConfig).not.toContain('href: "/api/auth/signin/github"');
    expect(signInPage).toContain("Continue with Google");
    expect(signInPage).toContain("first sign-in creates the account automatically");
    expect(signInPage).toContain("No separate");
    expect(signInPage).toContain("username or password");
    expect(guestBanner).toContain("Welcome back");
    expect(guestBanner).toContain("Signed in — your watchlist and portfolio sync across devices.");
  });

  it("uses Google as the only identity provider", () => {
    expect(authConfig).toContain('import Google from "next-auth/providers/google"');
    expect(authConfig).toContain("providers: [Google]");
    expect(authConfig).not.toContain("GitHub");
    expect(authConfig).not.toContain("providers/github");
    expect(readiness).toContain('"AUTH_GOOGLE_ID"');
    expect(readiness).toContain('"AUTH_GOOGLE_SECRET"');
    expect(readiness).not.toContain("AUTH_GITHUB");
    expect(navConfig).toContain("Continue with Google. Your first sign-in creates the account.");
  });
});
