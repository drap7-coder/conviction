import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizePortfolioPositions } from "@/lib/user-portfolio";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("Neon portfolio sync", () => {
  it("normalizes, deduplicates, and rejects unsafe positions", () => {
    expect(normalizePortfolioPositions([
      { ticker: " aapl ", shares: 10, averageCost: 150 },
      { ticker: "AAPL", shares: 12, averageCost: 155 },
      { ticker: "BTC-USD", shares: 0.25 },
      { ticker: "BAD SQL;", shares: 2 },
      { ticker: "MSFT", shares: -1 },
    ])).toEqual([
      { ticker: "AAPL", shares: 12, averageCost: 155, note: undefined },
      { ticker: "BTC-USD", shares: 0.25, averageCost: undefined, note: undefined },
    ]);
  });

  it("defines an idempotent per-user Neon portfolio table", () => {
    expect(existsSync(new URL("../migrations/002_user_portfolio_positions.sql", import.meta.url))).toBe(true);
    const migration = read("migrations/002_user_portfolio_positions.sql");
    const readiness = read("src/lib/auth-readiness.ts");

    expect(migration).toContain("create table if not exists portfolio_positions");
    expect(migration).toContain("references users(id) on delete cascade");
    expect(migration).toContain("unique (user_id, ticker)");
    expect(migration).toContain("create index if not exists portfolio_positions_user_id_idx");
    expect(readiness).toContain('"portfolio_positions"');
  });

  it("keeps server reads and writes scoped to the signed-in user", () => {
    const store = read("src/lib/user-portfolio.ts");
    const route = read("src/app/api/portfolio/route.ts");
    const migrationRoute = read("src/app/api/portfolio/migrate/route.ts");

    expect(store).toContain("where user_id = $1");
    expect(store).toContain("delete from portfolio_positions where user_id = $1");
    expect(route).toContain("getOptionalSession");
    expect(route).toContain("replaceUserPortfolio(userId");
    expect(migrationRoute).toContain("migrateUserPortfolio(userId");
  });

  it("migrates browser holdings after sign-in and uses synced holdings across the app", () => {
    const client = read("src/lib/portfolio/client.ts");
    const provider = read("src/components/PortfolioData.tsx");
    const news = read("src/components/market/PulseNewsFeed.tsx");

    expect(client).toContain('fetch("/api/portfolio/migrate"');
    expect(client).toContain("conviction-portfolio-migrated");
    expect(provider).toContain("loadPortfolioForViewer");
    expect(provider).toContain("positions: PersistedPosition[]");
    expect(news).toContain("loadPortfolioForViewer");
  });
});
