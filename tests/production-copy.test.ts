import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("production copy and fixture isolation", () => {
  it("keeps real company pages detached from fixture/demo evidence", () => {
    const companyPage = read("src/app/companies/[ticker]/page.tsx");
    const journalPage = read("src/app/journal/page.tsx");

    expect(companyPage).not.toContain("FIXTURE_COMPANIES");
    expect(companyPage).not.toContain("FIXTURE_JOURNAL_ENTRIES");
    expect(companyPage).not.toContain("DEMO_LABEL");
    expect(companyPage).not.toContain("legacy-context");
    expect(journalPage).not.toContain("FIXTURE_JOURNAL_ENTRIES");
    expect(journalPage).not.toContain("DEMO DATA");
  });

  it("does not render setup instructions in the guest watchlist experience", () => {
    const homePage = read("src/app/page.tsx");
    const watchlistRoute = read("src/app/api/watchlist/route.ts");

    for (const source of [homePage, watchlistRoute]) {
      expect(source).not.toContain("Sign-in setup needed");
      expect(source).not.toContain("DATABASE_URL is not configured");
      expect(source).not.toContain("GitHub");
      expect(source).not.toContain("Neon");
    }
  });

  it("keeps the mobile add-company composer from forcing horizontal overflow", () => {
    const css = read("src/app/globals.css");

    expect(css).toContain(".watchlist-add");
    expect(css).toContain(".watchlist-input-wrap");
    expect(css).toContain("min-width: 0");
    expect(css).toContain("text-overflow: ellipsis");
  });
});
